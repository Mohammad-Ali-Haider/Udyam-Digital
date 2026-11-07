// Explicit opt-in live-provider check. Never logs credentials or provider response bodies.
import "../apps/server/src/config.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { buildApp } from "../apps/server/src/app.js";
import { openDatabase } from "../apps/server/src/db.js";
import { calculateQuote, products } from "../apps/server/src/catalogue.js";

if (!process.env.OPENROUTER_API_KEY?.trim()) {
  console.error(
    "BLOCKED: OPENROUTER_API_KEY is empty in apps/server/.env. No live request sent.",
  );
  process.exitCode = 2;
} else {
  const originalFetch = globalThis.fetch;
  let providerStatus: number | null = null;
  globalThis.fetch = async (...args) => {
    const result = await originalFetch(...args);
    providerStatus = result.status;
    return result;
  };
  const store = openDatabase(":memory:");
  const { app } = await buildApp({ store });
  try {
    const profile = JSON.parse(
      readFileSync(
        new URL(
          "../apps/server/tests/fixtures/demo-profile.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ).profile;
    const token = (
      await app.inject({
        method: "POST",
        url: "/api/v1/sessions",
        payload: { platform: "native" },
      })
    ).json().token;
    const headers = { authorization: `Bearer ${token}` };
    const request = (
      method: "POST" | "PATCH" | "GET",
      path: string,
      payload?: unknown,
    ) => app.inject({ method, url: `/api/v1${path}`, headers, payload });
    assert.equal(
      (await request("PATCH", "/profile", { profile, revision: 0 })).statusCode,
      200,
    );
    const reply = await request("POST", "/advisor/messages", {
      text: "I need reliable fibre and billing for one counter. My budget is Rs 2500. Keep the bundle simple.",
      requestId: randomUUID(),
    });
    const mode = reply.json().mode;
    if (mode !== "live") {
      const reason =
        providerStatus === 401
          ? "provider rejected credentials"
          : providerStatus === 402
            ? "provider credits/payment required"
            : providerStatus === 429
              ? "provider rate limit"
              : providerStatus === 200
                ? "provider response failed schema/parsing validation"
                : providerStatus
                  ? "provider HTTP error"
                  : "network failure or timeout";
      console.error(
        JSON.stringify({
          status: "BLOCKED",
          providerStatus,
          reason,
          applicationMode: mode,
        }),
      );
      process.exitCode = 2;
    } else {
      const journey = (await request("GET", "/journey")).json();
      assert.equal(journey.messages.at(-1).mode, "live");
      assert.ok(
        journey.recommendation.every((s: { productId: string }) =>
          products.some((p) => p.id === s.productId),
        ),
      );
      const quote = (
        await request("POST", "/quotes", {
          selection: journey.recommendation,
          revision: journey.revision,
        })
      ).json();
      const expected = calculateQuote(
        journey.profile,
        journey.recommendation,
        journey.revision,
      );
      assert.equal(quote.monthlyPaise, expected.monthlyPaise);
      assert.equal(quote.setupPaise, expected.setupPaise);
      assert.equal(
        (
          await request("POST", "/quotes", {
            selection: [{ productId: "P99", quantity: 1 }],
            revision: quote.revision,
          })
        ).json().code,
        "unknown_product",
      );
      assert.equal(
        (
          await request("POST", "/quotes", {
            selection: [{ productId: "P10", quantity: 1 }],
            revision: quote.revision,
          })
        ).json().code,
        "ineligible_product",
      );
      assert.equal(
        (
          await request("POST", "/quotes", {
            selection: [{ productId: "P23", quantity: 1 }],
            revision: quote.revision,
          })
        ).json().code,
        "missing_dependency",
      );
      console.log(
        JSON.stringify({
          status: "PASS",
          providerStatus,
          applicationMode: mode,
          model: process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini",
          products: journey.recommendation,
          monthlyPaise: quote.monthlyPaise,
          setupPaise: quote.setupPaise,
          checks: [
            "persisted live mode",
            "server prices",
            "catalogue membership",
            "eligibility",
            "dependencies",
          ],
        }),
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
    await app.close();
    store.sqlite.close();
  }
}
