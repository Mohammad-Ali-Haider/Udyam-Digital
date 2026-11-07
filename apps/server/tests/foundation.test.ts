import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";
import { openDatabase } from "../src/db.js";
import { calculateQuote, products } from "../src/catalogue.js";
import type { BusinessProfile } from "@udyam/shared";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { runtimeRoot } from "../src/config.js";

export const profile: BusinessProfile = {
  businessName: "Test Kirana",
  signatoryName: "Test Owner",
  city: "Delhi",
  state: "Delhi",
  address: "12 Market Road, Delhi 110001",
  cityTier: 1,
  employees: 2,
  counters: 1,
  budget: 2000,
  internet: "hotspot",
  fibreAvailable: true,
  needs: ["billing"],
  hasGstin: false,
  language: "en",
};
test("catalogue prices and dependencies are authoritative", () => {
  assert.equal(products.length, 25);
  const quote = calculateQuote(
    profile,
    [
      { productId: "P01", quantity: 1 },
      { productId: "P19", quantity: 1 },
    ],
    1,
  );
  assert.equal(quote.monthlyPaise, 159800);
  assert.equal(quote.setupPaise, 250000);
  assert.throws(
    () => calculateQuote(profile, [{ productId: "P23", quantity: 1 }], 1),
    /requires/,
  );
  assert.throws(
    () =>
      calculateQuote(
        profile,
        [{ productId: "P15", quantity: 1 }],
        1,
        false,
        true,
      ),
    /GST/,
  );
});
test("native sessions require credentials and cannot use web transport", async () => {
  const store = openDatabase(":memory:");
  const { app } = await buildApp({ store });
  assert.equal(
    (await app.inject({ method: "GET", url: "/api/v1/catalogue" })).statusCode,
    401,
  );
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/sessions",
    payload: { platform: "native" },
  });
  const { token } = response.json();
  assert.equal(
    (
      await app.inject({
        method: "GET",
        url: "/api/v1/catalogue",
        headers: { authorization: `Bearer ${token}` },
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await app.inject({
        method: "GET",
        url: "/api/v1/catalogue",
        headers: { cookie: `udyam_session=${token}` },
      })
    ).statusCode,
    401,
  );
  await app.close();
  store.sqlite.close();
});

test("a backend restart restores the session and accepted quote from SQLite", async () => {
  mkdirSync(runtimeRoot, { recursive: true });
  const directory = mkdtempSync(resolve(runtimeRoot, "persistence-test-"));
  const path = resolve(directory, "test.sqlite");
  let store = openDatabase(path);
  let { app } = await buildApp({ store });
  try {
    const session = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      payload: { platform: "native" },
    });
    const headers = { authorization: `Bearer ${session.json().token}` };
    await app.inject({
      method: "PATCH",
      url: "/api/v1/profile",
      headers,
      payload: { profile, revision: 0 },
    });
    const quote = await app.inject({
      method: "POST",
      url: "/api/v1/quotes",
      headers,
      payload: { revision: 1, selection: [{ productId: "P01", quantity: 1 }] },
    });
    assert.equal(quote.statusCode, 200);
    await app.inject({
      method: "POST",
      url: `/api/v1/quotes/${quote.json().id}/accept`,
      headers,
      payload: {},
    });
    await app.close();
    store.sqlite.close();
    store = openDatabase(path);
    ({ app } = await buildApp({ store }));
    const restored = await app.inject({
      method: "GET",
      url: "/api/v1/journey",
      headers,
    });
    assert.equal(restored.statusCode, 200);
    assert.equal(restored.json().profile.businessName, profile.businessName);
    assert.equal(restored.json().quote.id, quote.json().id);
    assert.ok(restored.json().quote.acceptedAt);
  } finally {
    await app.close();
    store.sqlite.close();
    if (!directory.startsWith(resolve(runtimeRoot) + requireSeparator()))
      throw new Error("Invalid test cleanup path");
    rmSync(directory, { recursive: true, force: true });
  }
});

function requireSeparator() {
  return process.platform === "win32" ? "\\" : "/";
}
