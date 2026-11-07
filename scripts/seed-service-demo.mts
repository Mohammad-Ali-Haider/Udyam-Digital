import { randomBytes, randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { openDatabase } from "../apps/server/src/db.js";
import {
  sessions,
  quotes,
  orders,
  documents,
} from "../apps/server/src/schema.js";
import { serverRoot } from "../apps/server/src/config.js";
import { calculateQuote } from "../apps/server/src/catalogue.js";
import { initialAdvisor } from "../apps/server/src/discovery.js";
import { backfillServices } from "../apps/server/src/services.js";
import { seedStaff } from "../apps/server/src/staff-auth.js";
import { eq } from "drizzle-orm";
import type { Order, AssistanceCase, SupportTicket } from "@udyam/shared";
const store = openDatabase();
seedStaff(store);
const profile = JSON.parse(
  readFileSync(resolve(serverRoot, "tests/fixtures/demo-profile.json"), "utf8"),
).profile;
const scenarios = [
  "new-discovery",
  "budget-difficulty",
  "abandoned-quote",
  "stale-kyc",
  "scheduled",
  "delayed",
  "active",
  "support",
];
let added = 0;
try {
  store.db.transaction(() => {
    for (const scenario of scenarios) {
      const sid = `fixture-service-${scenario}`;
      if (store.db.select().from(sessions).where(eq(sessions.id, sid)).get())
        continue;
      const at = new Date().toISOString();
      const p = {
        ...profile,
        businessName: `[Synthetic fixture] ${scenario}`,
        budget: scenario === "budget-difficulty" ? 500 : 2500,
      };
      store.db
        .insert(sessions)
        .values({
          id: sid,
          tokenHash: createHash("sha256").update(randomBytes(32)).digest("hex"),
          transport: "native",
          updatedAt: Date.now(),
          activityAt:
            Date.now() - (scenario === "abandoned-quote" ? 660000 : 0),
          profile: p,
          advisorState: initialAdvisor(p, scenario !== "new-discovery"),
          advisorStep: scenario === "new-discovery" ? 0 : 6,
        })
        .run();
      const quote = calculateQuote(
        p,
        [
          { productId: "P01", quantity: 1 },
          { productId: "P19", quantity: 1 },
        ],
        1,
      );
      if (scenario !== "new-discovery") {
        quote.acceptedAt = at;
        store.db
          .insert(quotes)
          .values({
            id: quote.id,
            sessionId: sid,
            revision: 1,
            current: true,
            data: quote,
          })
          .run();
      }
      if (
        ["budget-difficulty", "abandoned-quote", "stale-kyc"].includes(scenario)
      ) {
        const c: AssistanceCase = {
          id: randomUUID(),
          revision: 0,
          assignee: null,
          explicit: scenario !== "abandoned-quote",
          allowStalled: true,
          reason: "Synthetic fixture: " + scenario,
          stage: scenario === "stale-kyc" ? "kyc" : "checkout",
          status: "open",
          messages: [],
          createdAt: at,
          fixture: true,
        };
        store.sqlite
          .prepare("INSERT INTO assistance(id,session_id,data) VALUES(?,?,?)")
          .run(c.id, sid, JSON.stringify(c));
      }
      if (scenario === "stale-kyc")
        store.db
          .insert(documents)
          .values({
            id: randomUUID(),
            sessionId: sid,
            kind: "address",
            status: "replacement_needed",
            fields: { date: "2026-01-01" },
            evidence: { date: "2026-01-01" },
            issues: ["address_date"],
            createdAt: at,
          })
          .run();
      if (["scheduled", "delayed", "active", "support"].includes(scenario)) {
        const id = randomUUID(),
          status = ["active", "support"].includes(scenario)
            ? "activated"
            : "scheduled";
        const order: Order = {
          id,
          quote,
          status,
          createdAt: at,
          events: [
            {
              id: randomUUID(),
              status: "confirmed",
              type: "stage",
              createdAt: at,
            },
            { id: randomUUID(), status, type: "stage", createdAt: at },
          ],
          estimates: quote.lines.map((l) => ({
            productId: l.product.id,
            date: new Date(
              Date.now() + l.product.installDays * 86400000,
            ).toISOString(),
          })),
        };
        store.db
          .insert(orders)
          .values({
            id,
            sessionId: sid,
            quoteId: quote.id,
            idempotencyKey: randomUUID(),
            data: order,
          })
          .run();
        store.sqlite
          .prepare(
            "INSERT INTO installation(order_id,session_id,data) VALUES(?,?,?)",
          )
          .run(
            id,
            sid,
            JSON.stringify({
              start: new Date(Date.now() + 86400000).toISOString(),
              end: new Date(Date.now() + 90000000).toISOString(),
              team: "Synthetic fixture team",
              delayReason:
                scenario === "delayed"
                  ? "Synthetic equipment delay"
                  : undefined,
              messages: [],
            }),
          );
        if (scenario === "support")
          for (const status of ["open", "resolved"] as const) {
            const ticket: SupportTicket = {
              id: randomUUID(),
              revision: 0,
              assignee: null,
              category: "billing",
              subject: `[Synthetic fixture] ${status} billing question`,
              status,
              messages: [
                {
                  id: randomUUID(),
                  author: "customer",
                  text: "Sample question about one-time setup.",
                  at,
                },
                ...(status === "resolved"
                  ? [
                      {
                        id: randomUUID(),
                        author: "staff" as const,
                        text: "Fixture resolution: setup is charged once.",
                        at,
                      },
                    ]
                  : []),
              ],
              createdAt: at,
            };
            store.sqlite
              .prepare(
                "INSERT INTO tickets(id,session_id,request_id,data) VALUES(?,?,?,?)",
              )
              .run(ticket.id, sid, randomUUID(), JSON.stringify(ticket));
          }
      }
      added++;
    }
    backfillServices(store);
  });
  console.log(
    `Prepared ${added} synthetic scenarios; existing journeys were preserved. Fixtures do not verify OCR or live AI.`,
  );
} finally {
  store.sqlite.close();
}
