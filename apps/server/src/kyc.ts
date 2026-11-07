import { createWorker, type Worker } from "tesseract.js";
import sharp from "sharp";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { eq, and } from "drizzle-orm";
import type {
  BusinessProfile,
  DocumentKind,
  KycDocument,
  KycResult,
} from "@udyam/shared";
import { KYC_REFERENCE_DATE } from "@udyam/shared";
import { gstRegistry, udyamRegistry, DomainError } from "./catalogue.js";
import { runtimeRoot } from "./config.js";
import type { Store } from "./db.js";
import { documents, sessions } from "./schema.js";

export const normalize = (text: string) =>
  text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
function contains(text: string, value: string) {
  return normalize(text).includes(normalize(value));
}
export function validGstin(value: string) {
  if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(value)) return false;
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const valuePart = chars.indexOf(value[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(valuePart / 36) + (valuePart % 36);
  }
  return chars[(36 - (sum % 36)) % 36] === value[14];
}
export function addressDateValid(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== value
  )
    return false;
  const age =
    (Date.parse(`${KYC_REFERENCE_DATE}T00:00:00Z`) - timestamp) / 86400000;
  return age >= 0 && age <= 90;
}
export function extractAndValidate(
  text: string,
  kind: DocumentKind,
  profile: BusinessProfile,
) {
  const fields: Record<string, string> = {};
  const issues: string[] = [];
  if (kind === "gst") {
    fields.gstin =
      text
        .toUpperCase()
        .match(/\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/)?.[0] || "";
    const record = gstRegistry.get(fields.gstin);
    if (!validGstin(fields.gstin)) issues.push("invalid_gstin");
    if (!record) issues.push("registry_missing");
    if (record) {
      fields.businessName = record.trade_name;
      fields.status = record.status;
      if (record.status.toLowerCase() !== "active") issues.push("gst_inactive");
      if (
        normalize(profile.businessName) !== normalize(record.trade_name) &&
        normalize(profile.businessName) !== normalize(record.legal_name)
      )
        issues.push("business_mismatch");
      if (
        !contains(text, record.trade_name) &&
        !contains(text, record.legal_name)
      )
        issues.push("business_mismatch");
      if (
        normalize(profile.address) !==
        normalize(record.principal_place_of_business)
      )
        issues.push("address_mismatch");
    }
  } else if (kind === "udyam") {
    fields.udyam =
      text.toUpperCase().match(/UDYAM-[A-Z]{2}-00-\d{7}/)?.[0] || "";
    const record = udyamRegistry.get(fields.udyam);
    if (!record) issues.push("registry_missing");
    if (record) {
      fields.businessName = record.enterprise_name;
      if (
        normalize(profile.businessName) !== normalize(record.enterprise_name) ||
        !contains(text, record.enterprise_name)
      )
        issues.push("business_mismatch");
      if (
        normalize(profile.city) !== normalize(record.city) ||
        normalize(profile.state) !== normalize(record.state)
      )
        issues.push("address_mismatch");
    }
  } else if (kind === "address") {
    fields.billDate =
      text.match(
        /(?:Bill date|Issue date|Date)[^\d\n]*([0-9]{4}-[0-9]{2}-[0-9]{2})/i,
      )?.[1] || "";
    fields.businessName = contains(text, profile.businessName)
      ? profile.businessName
      : "";
    fields.address = contains(text, profile.address) ? profile.address : "";
    if (!addressDateValid(fields.billDate)) issues.push("address_date");
    if (!fields.businessName) issues.push("business_mismatch");
    if (!fields.address) issues.push("address_mismatch");
  } else {
    fields.signatoryName = contains(text, profile.signatoryName)
      ? profile.signatoryName
      : "";
    if (!fields.signatoryName) issues.push("signatory_mismatch");
    if (!/signatory|identity|ID card|identification/i.test(text))
      issues.push("document_unreadable");
  }
  if (text.trim().length < 30) issues.push("document_unreadable");
  return { fields, issues: [...new Set(issues)] };
}
export function getKyc(store: Store, sessionId: string): KycResult {
  const rows = store.db
    .select()
    .from(documents)
    .where(eq(documents.sessionId, sessionId))
    .all();
  const docs = rows.map(({ id, kind, status, fields, issues, createdAt }) => ({
    id,
    kind,
    status,
    fields: {
      ...fields,
      ...(fields.gstin
        ? {
            gstin: `${fields.gstin.slice(0, 2)}••••••••••${fields.gstin.slice(-3)}`,
          }
        : {}),
      ...(fields.udyam
        ? { udyam: `UDYAM-••-••-${fields.udyam.slice(-4)}` }
        : {}),
    },
    issues,
    createdAt,
  })) as KycDocument[];
  const verified = (kind: string) =>
    rows.some((d) => d.kind === kind && d.status === "verified");
  let status: KycResult["status"] = "review_required";
  if (rows.some((d) => d.status === "processing")) status = "processing";
  else if (rows.some((d) => d.status === "replacement_needed"))
    status = "replacement_needed";
  else if (
    (verified("gst") || verified("udyam")) &&
    verified("address") &&
    verified("signatory")
  )
    status = "verified";
  return { status, gstActive: verified("gst"), documents: docs };
}

export class OcrQueue {
  private worker: Worker | null = null;
  private pending = 0;
  private tail: Promise<void> = Promise.resolve();
  constructor(private store: Store) {}
  async prepareImage(buffer: Buffer) {
    const png = buffer
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
    if (!png && !jpeg)
      throw new DomainError(
        "image_required",
        "PNG या JPEG फ़ाइल चुनें।",
        "Choose a PNG or JPEG image.",
      );
    const metadata = await sharp(buffer, {
      limitInputPixels: 24_000_000,
    }).metadata();
    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width < 200 ||
      metadata.height < 200
    )
      throw new DomainError(
        "image_too_small",
        "साफ़ और बड़ी तस्वीर चुनें।",
        "Choose a clear, larger image.",
      );
    return sharp(buffer, { limitInputPixels: 24_000_000 })
      .rotate()
      .resize({
        width: 1800,
        height: 2400,
        fit: "inside",
        withoutEnlargement: true,
      })
      .grayscale()
      .normalize()
      .png()
      .toBuffer();
  }
  enqueue(
    id: string,
    buffer: Buffer,
    kind: DocumentKind,
    profile: BusinessProfile,
  ) {
    if (this.pending >= 4)
      throw new DomainError(
        "ocr_busy",
        "प्रसंस्करण व्यस्त है। थोड़ी देर बाद कोशिश करें।",
        "Document processing is busy. Retry shortly.",
        503,
      );
    this.pending++;
    this.tail = this.tail.then(async () => {
      try {
        const langPath = resolve(runtimeRoot, "ocr");
        if (!existsSync(resolve(langPath, "eng.traineddata.gz")))
          throw new Error("OCR assets missing");
        if (!this.worker)
          this.worker = await createWorker("eng", 1, {
            langPath,
            cachePath: langPath,
            logger: () => {},
          });
        const result = await this.worker.recognize(buffer);
        const validation = extractAndValidate(result.data.text, kind, profile);
        this.store.db
          .update(documents)
          .set({
            fields: validation.fields,
            evidence: validation.fields,
            issues: validation.issues,
            status: validation.issues.length
              ? "replacement_needed"
              : "verified",
          })
          .where(eq(documents.id, id))
          .run();
      } catch {
        this.store.db
          .update(documents)
          .set({ status: "replacement_needed", issues: ["processing_failed"] })
          .where(eq(documents.id, id))
          .run();
      } finally {
        buffer.fill(0);
        this.pending--;
      }
    });
  }
  async close() {
    await this.tail;
    await this.worker?.terminate();
  }
}
