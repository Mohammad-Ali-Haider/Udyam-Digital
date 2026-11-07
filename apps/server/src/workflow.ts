import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, eq, desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  selectionSchema,
  CONSENT_VERSION,
  advisorQuestions,
  type BusinessProfile,
  type DocumentKind,
  type Order,
  type Message,
} from "@udyam/shared";
import { sessions, quotes, documents, orders } from "./schema.js";
import type { Store } from "./db.js";
import { sessionFor, currentQuote, ensureEditable } from "./app.js";
import { calculateQuote, DomainError } from "./catalogue.js";
import { discover, initialAdvisor } from "./discovery.js";
import { getKyc, OcrQueue } from "./kyc.js";
import { serverRoot } from "./config.js";

const kinds = z.enum(["gst", "udyam", "address", "signatory"]);
export async function registerWorkflow(app: FastifyInstance, store: Store) {
  const ocr = new OcrQueue(store);
  const requireProfile = (id: string) => {
    const session = sessionFor(store, id);
    if (!session.profile)
      throw new DomainError(
        "profile_required",
        "पहले व्यवसाय की जानकारी भरें।",
        "Complete the business profile first.",
      );
    return { ...session, profile: session.profile };
  };
  app.get("/api/v1/journey", async (req) => {
    const session = sessionFor(store, req.sessionId);
    return {
      revision: session.revision,
      profile: session.profile,
      messages: session.messages,
      recommendation: session.recommendation,
      advisorStep: session.advisorStep,
      advisorState:
        session.advisorState ||
        (session.profile
          ? initialAdvisor(session.profile, session.advisorStep >= 6)
          : null),
      quote: currentQuote(store, req.sessionId),
      consent: session.consent,
      kyc: getKyc(store, req.sessionId),
      order:
        store.db
          .select()
          .from(orders)
          .where(eq(orders.sessionId, req.sessionId))
          .get()?.data || null,
    };
  });
  app.post("/api/v1/advisor/messages", async (req) => {
    ensureEditable(store, req.sessionId);
    const { text, requestId, language } = z
      .object({
        text: z.string().trim().min(1).max(1000),
        requestId: z.string().uuid(),
        language: z.enum(["en", "hi"]).optional(),
      })
      .parse(req.body);
    const session = requireProfile(req.sessionId);
    if (session.messages.some((m) => m.id === requestId))
      return { saved: true };
    if (session.messages.length >= 40)
      throw new DomainError(
        "conversation_limit",
        "बंडल की समीक्षा करें या नया डेमो शुरू करें।",
        "Review your bundle or start a new demo.",
      );
    const result = await discover(
      { ...session.profile, language: language || session.profile.language },
      session.advisorState ||
        initialAdvisor(session.profile, session.advisorStep >= 6),
      text,
      session.messages,
    );
    const latest = sessionFor(store, req.sessionId);
    if (latest.revision !== session.revision)
      throw new DomainError(
        "stale_revision",
        "जानकारी बदली है। फिर कोशिश करें।",
        "The journey changed. Refresh and retry.",
        409,
      );
    const messages: Message[] = [
      ...session.messages,
      {
        id: requestId,
        role: "user",
        text,
        createdAt: new Date().toISOString(),
      },
      {
        id: randomUUID(),
        role: "assistant",
        text: result.answer,
        mode: result.mode,
        createdAt: new Date().toISOString(),
      },
    ];
    store.db.transaction((tx) => {
      tx.update(sessions)
        .set({
          profile: result.profile,
          advisorState: result.state,
          messages,
          recommendation: result.recommendation,
          advisorStep: Math.min(
            session.advisorStep + 1,
            advisorQuestions.length,
          ),
          revision: session.revision + 1,
        })
        .where(eq(sessions.id, req.sessionId))
        .run();
      if (JSON.stringify(result.profile) !== JSON.stringify(session.profile))
        tx.update(quotes)
          .set({ current: false })
          .where(eq(quotes.sessionId, req.sessionId))
          .run();
    });
    return { saved: true, mode: result.mode };
  });
  app.post("/api/v1/quotes", async (req) => {
    ensureEditable(store, req.sessionId);
    const { selection, revision } = z
      .object({ selection: selectionSchema, revision: z.number().int() })
      .parse(req.body);
    const session = requireProfile(req.sessionId);
    if (revision !== session.revision)
      throw new DomainError(
        "stale_revision",
        "जानकारी बदली है। ताज़ा करें।",
        "The journey changed. Refresh the quote.",
        409,
      );
    const quote = calculateQuote(
      session.profile,
      selection,
      revision + 1,
      getKyc(store, req.sessionId).gstActive,
    );
    store.db.transaction((tx) => {
      tx.update(quotes)
        .set({ current: false })
        .where(eq(quotes.sessionId, req.sessionId))
        .run();
      tx.insert(quotes)
        .values({
          id: quote.id,
          sessionId: req.sessionId,
          revision: quote.revision,
          data: quote,
          current: true,
        })
        .run();
      tx.update(sessions)
        .set({ revision: revision + 1 })
        .where(eq(sessions.id, req.sessionId))
        .run();
    });
    return quote;
  });
  app.post("/api/v1/quotes/:id/accept", async (req) => {
    ensureEditable(store, req.sessionId);
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const quote = currentQuote(store, req.sessionId);
    if (!quote || quote.id !== id)
      throw new DomainError(
        "stale_quote",
        "नया कोटेशन स्वीकार करें।",
        "Accept the current quote.",
        409,
      );
    const updated = {
      ...quote,
      acceptedAt: quote.acceptedAt || new Date().toISOString(),
    };
    store.db
      .update(quotes)
      .set({ data: updated })
      .where(eq(quotes.id, id))
      .run();
    return updated;
  });
  app.post("/api/v1/consents", async (req) => {
    ensureEditable(store, req.sessionId);
    const consent = z
      .object({
        version: z.literal(CONSENT_VERSION),
        language: z.enum(["en", "hi"]),
        accepted: z.literal(true),
      })
      .parse(req.body);
    if (!currentQuote(store, req.sessionId)?.acceptedAt)
      throw new DomainError(
        "quote_required",
        "पहले कोटेशन स्वीकार करें।",
        "Accept the quote first.",
      );
    const identity = requireProfile(req.sessionId).profile;
    if (
      identity.signatoryName.trim().length < 2 ||
      identity.address.trim().length < 8
    )
      throw new DomainError(
        "identity_required",
        "हस्ताक्षरकर्ता और पूरा पता दें।",
        "Provide the signatory name and full address before KYC.",
      );
    const record = {
      version: consent.version,
      language: consent.language,
      at: new Date().toISOString(),
    };
    store.db
      .update(sessions)
      .set({ consent: record })
      .where(eq(sessions.id, req.sessionId))
      .run();
    return record;
  });
  const requireConsent = (id: string) => {
    ensureEditable(store, id);
    const session = requireProfile(id);
    if (session.consent?.version !== CONSENT_VERSION)
      throw new DomainError(
        "consent_required",
        "पहले सहमति दें।",
        "Consent is required before uploading documents.",
      );
    return session.profile;
  };
  async function processDocument(
    sessionId: string,
    kind: DocumentKind,
    buffer: Buffer,
    profile: BusinessProfile,
  ) {
    const image = await ocr.prepareImage(buffer);
    buffer.fill(0);
    // Recheck after image decoding so reset or identity edits cannot attach stale evidence.
    const latest = requireConsent(sessionId);
    if (JSON.stringify(latest) !== JSON.stringify(profile))
      throw new DomainError(
        "profile_changed",
        "व्यवसाय की जानकारी बदली है। फिर अपलोड करें।",
        "The profile changed. Upload again.",
        409,
      );
    const existing = store.db
      .select()
      .from(documents)
      .where(and(eq(documents.sessionId, sessionId), eq(documents.kind, kind)))
      .get();
    if (existing?.status === "processing")
      throw new DomainError(
        "already_processing",
        "यह दस्तावेज़ अभी जाँचा जा रहा है।",
        "This document is already processing.",
        409,
      );
    const id = randomUUID();
    store.db.transaction((tx) => {
      tx.delete(documents)
        .where(
          and(eq(documents.sessionId, sessionId), eq(documents.kind, kind)),
        )
        .run();
      tx.insert(documents)
        .values({
          id,
          sessionId,
          kind,
          status: "processing",
          fields: {},
          evidence: {},
          issues: [],
          createdAt: new Date().toISOString(),
        })
        .run();
    });
    try {
      ocr.enqueue(id, image, kind, profile);
    } catch (error) {
      store.db
        .update(documents)
        .set({ status: "replacement_needed", issues: ["processing_failed"] })
        .where(eq(documents.id, id))
        .run();
      throw error;
    }
    return { id, status: "processing" };
  }
  app.post("/api/v1/kyc/documents", async (req, reply) => {
    const profile = requireConsent(req.sessionId);
    const part = await req.file();
    if (!part)
      throw new DomainError(
        "file_required",
        "दस्तावेज़ चुनें।",
        "Choose a document.",
      );
    const buffer = await part.toBuffer();
    if (!["image/png", "image/jpeg"].includes(part.mimetype))
      throw new DomainError(
        "image_required",
        "PNG या JPEG चुनें।",
        "Choose PNG or JPEG.",
      );
    const field = part.fields.kind;
    const kind = kinds.parse(
      field && !Array.isArray(field) && field.type === "field"
        ? field.value
        : undefined,
    );
    reply.code(202);
    return processDocument(req.sessionId, kind, buffer, profile);
  });
  app.get("/api/v1/kyc", async (req) => getKyc(store, req.sessionId));
  app.patch("/api/v1/kyc/documents/:id", async (req) => {
    requireConsent(req.sessionId);
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { fields } = z
      .object({ fields: z.record(z.string(), z.string().max(300)) })
      .parse(req.body);
    const doc = store.db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.sessionId, req.sessionId)))
      .get();
    if (!doc)
      throw new DomainError(
        "not_found",
        "दस्तावेज़ नहीं मिला।",
        "Document not found.",
        404,
      );
    if (doc.status === "processing")
      throw new DomainError(
        "processing",
        "जाँच पूरी होने दें।",
        "Wait for processing to finish.",
        409,
      );
    if (Object.keys(fields).some((k) => !Object.hasOwn(doc.evidence, k)))
      throw new DomainError(
        "invalid_fields",
        "निकाले गए फ़ील्ड ही सुधारें।",
        "Only extracted fields can be corrected.",
      );
    const edited = { ...doc.fields, ...fields };
    const changed = Object.keys(edited).some(
      (k) => edited[k] !== doc.evidence[k],
    );
    const issues = [
      ...doc.issues.filter((i) => i !== "manual_review"),
      ...(changed ? ["manual_review"] : []),
    ];
    // A correction never erases a failed evidence check.
    store.db
      .update(documents)
      .set({
        fields: edited,
        issues,
        status: changed
          ? "review_required"
          : issues.length
            ? "replacement_needed"
            : "verified",
      })
      .where(eq(documents.id, id))
      .run();
    return getKyc(store, req.sessionId);
  });
  app.post("/api/v1/orders", async (req) => {
    const { quoteId, requestId } = z
      .object({ quoteId: z.string().uuid(), requestId: z.string().uuid() })
      .parse(req.body);
    return store.db.transaction((tx) => {
      const existing = tx
        .select()
        .from(orders)
        .where(eq(orders.sessionId, req.sessionId))
        .get();
      if (existing) {
        if (existing.quoteId !== quoteId)
          throw new DomainError(
            "order_exists",
            "ऑर्डर पहले बन चुका है।",
            "An order already exists.",
            409,
          );
        return existing.data;
      }
      const session = requireProfile(req.sessionId);
      const quote = currentQuote(store, req.sessionId);
      if (!quote || quote.id !== quoteId || !quote.acceptedAt)
        throw new DomainError(
          "quote_required",
          "मौजूदा कोटेशन स्वीकार करें।",
          "Accept the current quote.",
          409,
        );
      if (!session.consent)
        throw new DomainError(
          "consent_required",
          "सहमति आवश्यक है।",
          "Consent is required.",
        );
      const kyc = getKyc(store, req.sessionId);
      if (kyc.status !== "verified")
        throw new DomainError(
          "kyc_required",
          "दस्तावेज़ सत्यापन पूरा करें।",
          "Complete document verification first.",
        );
      calculateQuote(
        session.profile,
        quote.lines.map((l) => ({
          productId: l.product.id,
          quantity: l.quantity,
        })),
        quote.revision,
        kyc.gstActive,
        true,
      );
      const now = new Date();
      const order: Order = {
        id: randomUUID(),
        quote,
        status: "confirmed",
        createdAt: now.toISOString(),
        events: [
          {
            id: randomUUID(),
            status: "confirmed",
            type: "stage",
            createdAt: now.toISOString(),
          },
        ],
        estimates: quote.lines.map((l) => ({
          productId: l.product.id,
          date: new Date(
            now.getTime() + l.product.installDays * 86400000,
          ).toISOString(),
        })),
      };
      tx.insert(orders)
        .values({
          id: order.id,
          sessionId: req.sessionId,
          quoteId,
          idempotencyKey: requestId,
          data: order,
        })
        .run();
      return order;
    });
  });
  const getOrder = (sessionId: string, id: string) => {
    const order = store.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, id), eq(orders.sessionId, sessionId)))
      .get();
    if (!order)
      throw new DomainError(
        "not_found",
        "ऑर्डर नहीं मिला।",
        "Order not found.",
        404,
      );
    return order.data;
  };
  app.get("/api/v1/orders/:id", async (req) =>
    getOrder(req.sessionId, z.object({ id: z.string() }).parse(req.params).id),
  );
  if (process.env.DEMO_CONTROLS !== "false") {
    app.get(
      "/api/v1/demo/profile",
      async () =>
        JSON.parse(
          await readFile(
            resolve(serverRoot, "tests/fixtures/demo-profile.json"),
            "utf8",
          ),
        ).profile,
    );
    app.post("/api/v1/demo/kyc/:kind", async (req, reply) => {
      const profile = requireConsent(req.sessionId);
      const { kind } = z.object({ kind: kinds }).parse(req.params);
      const { stale } = z
        .object({ stale: z.boolean().optional() })
        .parse(req.body || {});
      const filename =
        kind === "address" && stale
          ? "demo-address-stale.png"
          : `demo-${kind}.png`;
      reply.code(202);
      return processDocument(
        req.sessionId,
        kind,
        await readFile(resolve(serverRoot, "tests/fixtures", filename)),
        profile,
      );
    });
    app.post("/api/v1/demo/orders/:id/advance", async () => {
      throw new DomainError(
        "staff_workflow_required",
        "स्टाफ पोर्टल से इंस्टॉलेशन अपडेट करें।",
        "Use the staff installation workflow.",
        410,
      );
    });
  }
  return ocr;
}
