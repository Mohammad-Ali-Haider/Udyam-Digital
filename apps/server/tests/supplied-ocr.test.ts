import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { openDatabase } from "../src/db.js";
import { OcrQueue } from "../src/kyc.js";
import { sessions, documents } from "../src/schema.js";
import { serverRoot } from "../src/config.js";
import type { DocumentKind } from "@udyam/shared";
test(
  "supplied OCR images match independently recorded registry and visual expectations",
  { timeout: 180000 },
  async (t) => {
    const store = openDatabase(":memory:"),
      ocr = new OcrQueue(store);
    const sid = randomUUID();
    store.db
      .insert(sessions)
      .values({
        id: sid,
        tokenHash: randomUUID(),
        transport: "native",
        updatedAt: Date.now(),
      })
      .run();
    const base = JSON.parse(
      readFileSync(
        resolve(serverRoot, "tests/fixtures/demo-profile.json"),
        "utf8",
      ),
    ).profile;
    const matrix = JSON.parse(
      readFileSync(
        resolve(serverRoot, "tests/fixtures/supplied-expectations.json"),
        "utf8",
      ),
    );
    try {
      for (const sample of matrix) {
        const id = randomUUID();
        store.db.delete(documents).run();
        store.db
          .insert(documents)
          .values({
            id,
            sessionId: sid,
            kind: sample.kind,
            status: "processing",
            fields: {},
            evidence: {},
            issues: [],
            createdAt: new Date().toISOString(),
          })
          .run();
        ocr.enqueue(
          id,
          await ocr.prepareImage(
            readFileSync(resolve(serverRoot, "tests/fixtures", sample.file)),
          ),
          sample.kind as DocumentKind,
          {
            ...base,
            businessName: sample.businessName,
            address: sample.address,
          },
        );
        const deadline = Date.now() + 60000;
        let doc = store.db
          .select()
          .from(documents)
          .where(eq(documents.id, id))
          .get()!;
        while (doc.status === "processing" && Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 100));
          doc = store.db
            .select()
            .from(documents)
            .where(eq(documents.id, id))
            .get()!;
        }
        const expected =
          sample.knownRecognitionFailure?.issues || sample.expectedIssues;
        assert.deepEqual(
          doc.issues.sort(),
          expected.sort(),
          sample.file + " " + sample.businessName,
        );
        assert.equal(
          doc.status,
          expected.length ? "replacement_needed" : "verified",
        );
        if (sample.knownRecognitionFailure)
          t.diagnostic(
            sample.file +
              ": semantic expectation " +
              JSON.stringify(sample.expectedIssues) +
              "; observed OCR limitation " +
              JSON.stringify(doc.issues) +
              "; replacement required.",
          );
      }
    } finally {
      await ocr.close();
      store.sqlite.close();
    }
  },
);
