import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildApp } from "../src/app.js";
import { openDatabase } from "../src/db.js";
import { sessions, documents } from "../src/schema.js";
import { serverRoot } from "../src/config.js";
import { discover, initialAdvisor } from "../src/discovery.js";
import { CONSENT_VERSION } from "@udyam/shared";
const fixture = JSON.parse(
  readFileSync(resolve(serverRoot, "tests/fixtures/demo-profile.json"), "utf8"),
);
test("adaptive discovery preserves required needs, refines optional extras and reports budget shortfalls", async () => {
  const key = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  try {
    let r = await discover(
      fixture.profile,
      null,
      "Billing essential, CCTV optional",
    );
    assert.equal(r.state.options.length, 2);
    assert.deepEqual(r.state.mustHave, ["billing"]);
    r = await discover(r.profile, r.state, "Make it cheaper");
    assert.deepEqual(r.state.mustHave, ["billing"]);
    assert.equal(r.state.options.length, 1);
    r = await discover(r.profile, r.state, "Budget 500");
    assert.equal(r.state.options[0].shortfallPaise, 109800);
    r = await discover(r.profile, r.state, "I already have billing software");
    assert.equal(r.state.mustHave.length, 0);
    r = await discover(r.profile, r.state, "Fibre is unavailable");
    assert.equal(r.recommendation[0].productId, "P04");
    assert.ok(r.state.confirmed.includes("tools"));
    assert.equal(r.mode, "demo");
    const simple = await discover(
      fixture.profile,
      null,
      "Keep it simple: billing is essential",
    );
    assert.ok(
      !simple.profile.needs.includes("sim"),
      "simple must not be interpreted as a SIM request",
    );
  } finally {
    if (key) process.env.OPENROUTER_API_KEY = key;
  }
});
test("connected assistance, assignments, installation, billing and support are isolated and idempotent", async () => {
  const env = { ...process.env };
  process.env.STAFF_OPERATIONS_PASSWORD = "test-operations-password";
  process.env.STAFF_PARTNER_A_PASSWORD = "test-partner-a-password";
  process.env.STAFF_PARTNER_B_PASSWORD = "test-partner-b-password";
  delete process.env.OPENROUTER_API_KEY;
  const store = openDatabase(":memory:");
  const { app } = await buildApp({ store });
  const origin = "http://localhost:3001";
  try {
    const login = async (username: string, password: string) => {
      const r = await app.inject({
        method: "POST",
        url: "/api/v1/staff/auth/login",
        headers: { origin },
        payload: { username, password },
      });
      assert.equal(r.statusCode, 200, r.body);
      return r.cookies[0].name + "=" + r.cookies[0].value;
    };
    const ops = await login(
        "operations",
        process.env.STAFF_OPERATIONS_PASSWORD!,
      ),
      a = await login("partner-a", process.env.STAFF_PARTNER_A_PASSWORD!),
      b = await login("partner-b", process.env.STAFF_PARTNER_B_PASSWORD!);
    const token = (
      await app.inject({
        method: "POST",
        url: "/api/v1/sessions",
        payload: { platform: "native" },
      })
    ).json().token;
    const customer = (method: any, path: string, payload?: any) =>
      app.inject({
        method,
        url: "/api/v1" + path,
        headers: { authorization: `Bearer ${token}` },
        payload,
      });
    const staff = (cookie: string, method: any, path: string, payload?: any) =>
      app.inject({
        method,
        url: "/api/v1/staff" + path,
        headers: { cookie, origin },
        payload,
      });
    assert.equal((await customer("GET", "/staff/cases")).statusCode, 401);
    await customer("PATCH", "/profile", {
      profile: fixture.profile,
      revision: 0,
    });
    assert.equal((await staff(ops, "GET", "/cases")).json().length, 0);
    let r = await customer("POST", "/assistance", {
      consent: true,
      reason: "Please help with a cheaper bundle",
      stage: "advisor",
      requestId: randomUUID(),
    });
    assert.equal(r.statusCode, 200, r.body);
    const caseId = r.json().id;
    assert.equal((await staff(a, "GET", "/cases")).json().length, 0);
    assert.equal(
      (
        await staff(ops, "POST", `/cases/${caseId}`, {
          action: "assign",
          assignee: "partner-a",
          revision: 0,
          requestId: randomUUID(),
        })
      ).statusCode,
      200,
    );
    assert.equal((await staff(b, "GET", `/cases/${caseId}`)).statusCode, 404);
    assert.equal(
      (
        await staff(a, "POST", `/cases/${caseId}`, {
          action: "note",
          text: "private-only",
          revision: 1,
          requestId: randomUUID(),
        })
      ).statusCode,
      200,
    );
    assert.ok(
      !(await customer("GET", "/assistance")).body.includes("private-only"),
    );
    assert.equal(
      (
        await staff(a, "POST", `/cases/${caseId}`, {
          action: "reply",
          text: "Keep only required billing and internet.",
          revision: 2,
          requestId: randomUUID(),
        })
      ).statusCode,
      200,
    );
    assert.ok(
      (await customer("GET", "/assistance")).body.includes("Keep only"),
    );
    r = await customer("POST", "/quotes", {
      selection: [
        { productId: "P01", quantity: 1 },
        { productId: "P19", quantity: 1 },
      ],
      revision: 1,
    });
    const quote = r.json();
    assert.equal(r.statusCode, 200, r.body);
    await customer("POST", `/quotes/${quote.id}/accept`);
    await customer("POST", "/consents", {
      version: CONSENT_VERSION,
      language: "en",
      accepted: true,
    });
    const owner = store.db.select().from(sessions).get()!;
    for (const kind of ["udyam", "address", "signatory"] as const)
      store.db
        .insert(documents)
        .values({
          id: randomUUID(),
          sessionId: owner.id,
          kind,
          status: "verified",
          fields: {},
          evidence: {},
          issues: [],
          createdAt: new Date().toISOString(),
        })
        .run();
    r = await customer("POST", "/orders", {
      quoteId: quote.id,
      requestId: randomUUID(),
    });
    assert.equal(r.statusCode, 200, r.body);
    const order = r.json();
    await staff(ops, "GET", "/orders");
    assert.equal(
      (
        await staff(a, "POST", `/orders/${order.id}`, {
          action: "start",
          revision: 0,
          requestId: randomUUID(),
        })
      ).statusCode,
      404,
    );
    assert.equal(
      (
        await staff(ops, "POST", `/orders/${order.id}`, {
          action: "assign",
          assignee: "partner-a",
          revision: 0,
          requestId: randomUUID(),
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await staff(a, "POST", `/orders/${order.id}`, {
          action: "activate",
          revision: 1,
          requestId: randomUUID(),
        })
      ).statusCode,
      409,
    );
    const change = async (action: string, revision: number, extra = {}) => {
      const r = await staff(a, "POST", `/orders/${order.id}`, {
        action,
        revision,
        requestId: randomUUID(),
        ...extra,
      });
      assert.equal(r.statusCode, 200, r.body);
    };
    await change("schedule", 1, {
      start: new Date(Date.now() + 86400000).toISOString(),
      end: new Date(Date.now() + 90000000).toISOString(),
      team: "Synthetic Team A",
    });
    await change("delay", 2, { text: "Demo equipment delay" });
    await change("start", 3);
    const activation = {
      action: "activate",
      revision: 4,
      requestId: randomUUID(),
    };
    assert.equal(
      (await staff(a, "POST", `/orders/${order.id}`, activation)).statusCode,
      200,
    );
    assert.equal(
      (await staff(a, "POST", `/orders/${order.id}`, activation)).statusCode,
      200,
    );
    const home = (await customer("GET", "/customer/home")).json();
    assert.equal(home.services.length, 2);
    assert.equal(home.statements.length, 1);
    assert.equal(home.statements[0].totalPaise, 409800);
    assert.equal(home.installation.delayReason, "Demo equipment delay");
    assert.equal(
      (await customer("GET", `/billing-statements/${order.id}/csv`)).statusCode,
      200,
    );
    const ticket = {
      category: "billing",
      subject: "Question about setup",
      text: "Why is setup included?",
      requestId: randomUUID(),
    };
    const tid = (await customer("POST", "/tickets", ticket)).json().id;
    assert.equal((await customer("POST", "/tickets", ticket)).json().id, tid);
    assert.equal(
      (
        await staff(ops, "POST", `/tickets/${tid}`, {
          action: "assign",
          assignee: "partner-a",
          revision: 0,
          requestId: randomUUID(),
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await staff(b, "POST", `/tickets/${tid}`, {
          action: "reply",
          text: "unauthorized",
          revision: 1,
          requestId: randomUUID(),
        })
      ).statusCode,
      404,
    );
    assert.equal(
      (
        await staff(a, "POST", `/tickets/${tid}`, {
          action: "status",
          status: "resolved",
          text: "",
          revision: 1,
          requestId: randomUUID(),
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await staff(a, "POST", `/tickets/${tid}`, {
          action: "status",
          status: "resolved",
          text: "Setup appears once in the first statement.",
          revision: 1,
          requestId: randomUUID(),
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await customer("POST", `/tickets/${tid}/messages`, {
          text: "One more question",
          reopen: true,
          revision: 2,
          requestId: randomUUID(),
        })
      ).statusCode,
      200,
    );
    assert.equal((await customer("GET", "/tickets")).json()[0].status, "open");
    assert.equal(
      (
        await staff(ops, "POST", `/cases/${caseId}`, {
          action: "assign",
          assignee: "partner-b",
          revision: 3,
          requestId: randomUUID(),
        })
      ).statusCode,
      200,
    );
    assert.equal((await staff(a, "GET", `/cases/${caseId}`)).statusCode, 404);
    await customer("DELETE", "/session");
    for (const table of [
      "services",
      "statements",
      "tickets",
      "assistance",
      "installation",
      "audit",
    ])
      assert.equal(
        (store.sqlite.prepare(`SELECT count(*) n FROM ${table}`).get() as any)
          .n,
        0,
      );
  } finally {
    await app.close();
    store.sqlite.close();
    for (const key of [
      "STAFF_OPERATIONS_PASSWORD",
      "STAFF_PARTNER_A_PASSWORD",
      "STAFF_PARTNER_B_PASSWORD",
      "OPENROUTER_API_KEY",
    ]) {
      if (env[key] === undefined) delete process.env[key];
      else process.env[key] = env[key];
    }
  }
});
