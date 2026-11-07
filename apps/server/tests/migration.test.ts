import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { openDatabase } from "../src/db.js";
import { buildApp } from "../src/app.js";
import { serverRoot } from "../src/config.js";
import { calculateQuote } from "../src/catalogue.js";
test("legacy database migration preserves credentials and frozen prices, backfills activation once", async () => {
  const dir = mkdtempSync(resolve(tmpdir(), "udyam-migration-")),
    file = resolve(dir, "old.sqlite"),
    old = new Database(file);
  const profile = JSON.parse(
    readFileSync(
      resolve(serverRoot, "tests/fixtures/demo-profile.json"),
      "utf8",
    ),
  ).profile;
  const token = randomUUID(),
    sid = randomUUID(),
    at = new Date().toISOString();
  const quote = calculateQuote(
    profile,
    [
      { productId: "P01", quantity: 1 },
      { productId: "P19", quantity: 2 },
    ],
    2,
  );
  quote.acceptedAt = at;
  const order = {
    id: randomUUID(),
    quote,
    status: "activated",
    createdAt: at,
    events: [
      { id: randomUUID(), status: "activated", type: "stage", createdAt: at },
    ],
    estimates: [],
  };
  old.exec(
    readFileSync(resolve(serverRoot, "drizzle/0000_initial.sql"), "utf8"),
  );
  old
    .prepare(
      "INSERT INTO sessions(id,token_hash,transport,updated_at,profile,advisor_step) VALUES(?,?,?,?,?,?)",
    )
    .run(
      sid,
      createHash("sha256").update(token).digest("hex"),
      "native",
      Date.now(),
      JSON.stringify(profile),
      6,
    );
  old
    .prepare("INSERT INTO quotes VALUES(?,?,?,?,?)")
    .run(quote.id, sid, 2, JSON.stringify(quote), 1);
  old
    .prepare("INSERT INTO orders VALUES(?,?,?,?,?)")
    .run(order.id, sid, quote.id, randomUUID(), JSON.stringify(order));
  old.close();
  try {
    for (let i = 0; i < 2; i++) {
      const store = openDatabase(file);
      const { app } = await buildApp({ store });
      try {
        const headers = { authorization: `Bearer ${token}` };
        const j = (
          await app.inject({ url: "/api/v1/journey", headers })
        ).json();
        assert.equal(j.advisorState.ready, true);
        assert.deepEqual(j.order.quote, quote);
        const home = (
          await app.inject({ url: "/api/v1/customer/home", headers })
        ).json();
        assert.equal(home.services.length, 2);
        assert.equal(home.statements.length, 1);
        assert.equal(
          home.statements[0].totalPaise,
          quote.monthlyPaise + quote.setupPaise,
        );
        assert.ok(existsSync(file + ".before-v3-backup"));
      } finally {
        await app.close();
        store.sqlite.close();
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
