import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type {
  AssistanceCase,
  SupportTicket,
  Order,
  Service,
  BillingStatement,
  ServiceMessage,
  StaffUser,
} from "@udyam/shared";
import { eq } from "drizzle-orm";
import type { Store } from "./db.js";
import { orders, sessions } from "./schema.js";
import { sessionFor, currentQuote } from "./app.js";
import { getKyc } from "./kyc.js";
import { requireStaff, staffError } from "./staff-auth.js";

type RecordRow = {
  id: string;
  session_id: string;
  assignee: string | null;
  revision: number;
  data: string;
};
const now = () => new Date().toISOString();
const textSchema = z.string().trim().min(1).max(1200);
const payloadSchema = z.object({
  revision: z.number().int(),
  action: z.enum([
    "reply",
    "note",
    "assign",
    "close",
    "followup",
    "schedule",
    "start",
    "delay",
    "activate",
    "status",
  ]),
  text: z.string().trim().max(1200).optional(),
  requestId: z.string().uuid(),
  assignee: z.string().nullable().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  team: z.string().max(100).optional(),
  status: z
    .enum(["open", "in_progress", "waiting_customer", "resolved"])
    .optional(),
});
function publicMessages<T extends { messages: ServiceMessage[] }>(data: T): T {
  return { ...data, messages: data.messages.filter((m) => !m.internal) };
}
function owned(row: RecordRow | undefined, req: FastifyRequest) {
  if (!row || row.session_id !== req.sessionId)
    staffError("not_found", "Record not found.", "रिकॉर्ड नहीं मिला।", 404);
  return row;
}
function accessible(row: RecordRow | undefined, user: StaffUser) {
  if (!row || (user.role !== "operations" && row.assignee !== user.id))
    staffError("not_found", "Record not found.", "रिकॉर्ड नहीं मिला।", 404);
  return row;
}
function assertRevision(row: { revision: number }, revision: number) {
  if (row.revision !== revision)
    staffError(
      "stale_revision",
      "This record changed. Refresh and retry.",
      "रिकॉर्ड बदल गया। ताज़ा करके कोशिश करें।",
      409,
    );
}
function audit(store: Store, req: FastifyRequest, sid: string, action: string) {
  store.sqlite
    .prepare("INSERT INTO audit VALUES(?,?,?,?,?)")
    .run(randomUUID(), sid, req.staff!.id, action, now());
}
function message(
  id: string,
  author: ServiceMessage["author"],
  text: string,
  internal = false,
): ServiceMessage {
  return { id, author, text, at: now(), internal };
}
function validAssignee(store: Store, value: string | null | undefined) {
  if (
    value &&
    !store.sqlite.prepare("SELECT id FROM staff_users WHERE id=?").get(value)
  )
    staffError(
      "invalid_assignee",
      "Choose an existing staff member.",
      "मौजूदा कर्मचारी चुनें।",
      400,
    );
}
export function provisionServices(store: Store, order: Order, sid: string) {
  if (order.status !== "activated") return;
  const at =
    [...order.events].reverse().find((e) => e.status === "activated")
      ?.createdAt || order.createdAt;
  for (const line of order.quote.lines) {
    const service: Service = {
      id: `${order.id}-${line.product.id}`,
      orderId: order.id,
      product: line.product,
      quantity: line.quantity,
      activatedAt: at,
      status: "active",
      simulation: true,
    };
    store.sqlite
      .prepare("INSERT OR IGNORE INTO services VALUES(?,?,?,?,?)")
      .run(service.id, sid, order.id, line.product.id, JSON.stringify(service));
  }
  const statement: BillingStatement = {
    id: order.id,
    orderId: order.id,
    issuedAt: at,
    period: at.slice(0, 7),
    lines: order.quote.lines,
    monthlyPaise: order.quote.monthlyPaise,
    setupPaise: order.quote.setupPaise,
    totalPaise: order.quote.monthlyPaise + order.quote.setupPaise,
    demo: true,
  };
  store.sqlite
    .prepare("INSERT OR IGNORE INTO statements VALUES(?,?,?,?)")
    .run(statement.id, sid, order.id, JSON.stringify(statement));
}
function installRecord(store: Store, orderId: string, sid: string) {
  store.sqlite
    .prepare(
      "INSERT OR IGNORE INTO installation(order_id,session_id,data) VALUES(?,?,?)",
    )
    .run(orderId, sid, JSON.stringify({ messages: [] }));
}
export function backfillServices(store: Store) {
  store.db.transaction(() => {
    for (const row of store.db.select().from(orders).all()) {
      installRecord(store, row.id, row.sessionId);
      provisionServices(store, row.data, row.sessionId);
    }
  });
}
export function registerServices(app: FastifyInstance, store: Store) {
  backfillServices(store);
  const caseRow = (sid: string) =>
    store.sqlite
      .prepare("SELECT * FROM assistance WHERE session_id=?")
      .get(sid) as RecordRow | undefined;
  const getOrder = (sid: string) =>
    store.db.select().from(orders).where(eq(orders.sessionId, sid)).get();
  const customerCase = (row: RecordRow) => ({
    ...publicMessages(JSON.parse(row.data)),
    id: row.id,
    revision: row.revision,
    assignee: row.assignee,
  });
  app.get("/api/v1/assistance", async (req) => {
    const row = caseRow(req.sessionId);
    return row ? customerCase(row) : null;
  });
  app.post("/api/v1/assistance", async (req) => {
    const input = z
      .object({
        consent: z.literal(true),
        explicit: z.boolean().default(true),
        allowStalled: z.boolean().default(false),
        reason: textSchema,
        stage: z.enum(["advisor", "checkout", "kyc"]),
        requestId: z.string().uuid(),
      })
      .parse(req.body);
    const s = sessionFor(store, req.sessionId);
    if (!s.profile)
      staffError(
        "profile_required",
        "Complete your shop profile first.",
        "पहले दुकान की जानकारी भरें।",
        400,
      );
    return store.db.transaction(() => {
      const old = caseRow(req.sessionId);
      const data: AssistanceCase = old
        ? JSON.parse(old.data)
        : {
            id: randomUUID(),
            revision: 0,
            assignee: null,
            explicit: false,
            allowStalled: false,
            reason: input.reason,
            stage: input.stage,
            status: "open",
            messages: [],
            createdAt: now(),
          };
      if (data.messages.some((m) => m.id === input.requestId))
        return customerCase(old!);
      data.explicit ||= input.explicit;
      data.allowStalled ||= input.allowStalled;
      data.status = "open";
      data.reason = input.reason;
      data.stage = input.stage;
      data.messages.push(message(input.requestId, "customer", input.reason));
      store.sqlite
        .prepare(
          "INSERT INTO assistance(id,session_id,data) VALUES(?,?,?) ON CONFLICT(session_id) DO UPDATE SET data=excluded.data, revision=revision+1",
        )
        .run(data.id, req.sessionId, JSON.stringify(data));
      return customerCase(caseRow(req.sessionId)!);
    });
  });
  app.post("/api/v1/assistance/messages", async (req) => {
    const input = z
      .object({
        text: textSchema,
        requestId: z.string().uuid(),
        revision: z.number().int(),
      })
      .parse(req.body);
    return store.db.transaction(() => {
      const row = owned(caseRow(req.sessionId), req);
      const data: AssistanceCase = JSON.parse(row.data);
      if (data.messages.some((m) => m.id === input.requestId))
        return customerCase(row);
      assertRevision(row, input.revision);
      data.messages.push(message(input.requestId, "customer", input.text));
      data.status = "open";
      store.sqlite
        .prepare("UPDATE assistance SET data=?,revision=revision+1 WHERE id=?")
        .run(JSON.stringify(data), row.id);
      return customerCase(caseRow(req.sessionId)!);
    });
  });
  app.delete("/api/v1/assistance", async (req) => {
    store.sqlite
      .prepare("DELETE FROM assistance WHERE session_id=?")
      .run(req.sessionId);
    return { ok: true };
  });
  function caseDetail(row: RecordRow) {
    const s = sessionFor(store, row.session_id);
    const data: AssistanceCase = JSON.parse(row.data);
    const quote = currentQuote(store, row.session_id);
    const kyc = getKyc(store, row.session_id);
    const reasons: string[] = [];
    let score = 0;
    if (data.explicit) {
      score += 40;
      reasons.push("help_requested");
    }
    if (quote?.acceptedAt) {
      score += 25;
      reasons.push("quote_accepted");
    }
    if (kyc.documents.some((d) => d.status !== "verified")) {
      score += 20;
      reasons.push("document_action");
    }
    if (Date.now() - s.activityAt >= 600000) {
      score += 15;
      reasons.push("inactive");
    }
    return {
      ...data,
      id: row.id,
      revision: row.revision,
      assignee: row.assignee,
      profile: s.profile,
      quote,
      kyc,
      lastActivity: s.activityAt,
      priority: {
        score,
        reasons,
        level: score >= 70 ? "high" : score >= 40 ? "medium" : "low",
      },
    };
  }
  app.get("/api/v1/staff/cases", async (req) => {
    const user = requireStaff(req);
    return (
      store.sqlite.prepare("SELECT * FROM assistance").all() as RecordRow[]
    )
      .filter((r) => user.role === "operations" || r.assignee === user.id)
      .map(caseDetail)
      .filter(
        (r) =>
          r.explicit ||
          (r.allowStalled && Date.now() - r.lastActivity >= 600000),
      )
      .sort((a, b) => b.priority.score - a.priority.score);
  });
  app.get<{ Params: { id: string } }>("/api/v1/staff/cases/:id", async (req) =>
    caseDetail(
      accessible(
        store.sqlite
          .prepare("SELECT * FROM assistance WHERE id=?")
          .get(req.params.id) as RecordRow | undefined,
        requireStaff(req),
      ),
    ),
  );
  app.post<{ Params: { id: string } }>(
    "/api/v1/staff/cases/:id",
    async (req) => {
      const input = payloadSchema.parse(req.body);
      const user = requireStaff(req);
      return store.db.transaction(() => {
        const row = accessible(
          store.sqlite
            .prepare("SELECT * FROM assistance WHERE id=?")
            .get(req.params.id) as RecordRow | undefined,
          user,
        );
        const data: AssistanceCase = JSON.parse(row.data);
        if (data.messages.some((m) => m.id === input.requestId))
          return caseDetail(row);
        assertRevision(row, input.revision);
        let assignee = row.assignee;
        if (input.action === "assign") {
          requireStaff(req, true);
          validAssignee(store, input.assignee);
          assignee = input.assignee ?? null;
        } else if (input.action === "close") data.status = "closed";
        else if (!["reply", "note", "followup"].includes(input.action))
          staffError(
            "invalid_action",
            "Choose a case action.",
            "मामले की कार्रवाई चुनें।",
            400,
          );
        const text =
          input.action === "assign"
            ? `Assigned: ${assignee || "operations"}`
            : textSchema.parse(input.text);
        data.messages.push(
          message(
            input.requestId,
            "staff",
            text,
            ["assign", "note", "followup"].includes(input.action),
          ),
        );
        store.sqlite
          .prepare(
            "UPDATE assistance SET data=?,assignee=?,revision=revision+1 WHERE id=?",
          )
          .run(JSON.stringify(data), assignee, row.id);
        audit(store, req, row.session_id, `case.${input.action}`);
        return { ok: true };
      });
    },
  );
  app.get("/api/v1/customer/home", async (req) => {
    const row = getOrder(req.sessionId);
    if (row) {
      installRecord(store, row.id, req.sessionId);
      provisionServices(store, row.data, req.sessionId);
    }
    const items = (table: "services" | "statements" | "tickets") =>
      (
        store.sqlite
          .prepare(`SELECT * FROM ${table} WHERE session_id=?`)
          .all(req.sessionId) as RecordRow[]
      ).map((r) =>
        table === "tickets"
          ? {
              ...publicMessages(JSON.parse(r.data)),
              id: r.id,
              revision: r.revision,
              assignee: r.assignee,
            }
          : JSON.parse(r.data),
      );
    const appointment = row
      ? (store.sqlite
          .prepare("SELECT * FROM installation WHERE order_id=?")
          .get(row.id) as RecordRow | undefined)
      : undefined;
    return {
      order: row?.data || null,
      services: items("services"),
      statements: items("statements"),
      tickets: items("tickets"),
      installation: appointment
        ? {
            ...JSON.parse(appointment.data),
            messages: undefined,
            revision: appointment.revision,
            assignee: appointment.assignee,
          }
        : null,
    };
  });
  app.get("/api/v1/services", async (req) =>
    (
      store.sqlite
        .prepare("SELECT data FROM services WHERE session_id=?")
        .all(req.sessionId) as { data: string }[]
    ).map((r) => JSON.parse(r.data)),
  );
  app.get("/api/v1/billing-statements", async (req) =>
    (
      store.sqlite
        .prepare("SELECT data FROM statements WHERE session_id=?")
        .all(req.sessionId) as { data: string }[]
    ).map((r) => JSON.parse(r.data)),
  );
  const csv = (rows: unknown[][]) =>
    "\ufeff" +
    rows
      .map((r) =>
        r
          .map(
            (v) =>
              '"' +
              String(v)
                .replace(/^[=+@-]/, "'")
                .replaceAll('"', '""') +
              '"',
          )
          .join(","),
      )
      .join("\r\n");
  app.get<{ Params: { id: string } }>(
    "/api/v1/billing-statements/:id/csv",
    async (req, reply) => {
      const row = store.sqlite
        .prepare("SELECT * FROM statements WHERE id=?")
        .get(req.params.id) as RecordRow | undefined;
      owned(row, req);
      const s: BillingStatement = JSON.parse(row!.data);
      reply
        .type("text/csv; charset=utf-8")
        .header(
          "Content-Disposition",
          `attachment; filename="demo-statement-${s.id}.csv"`,
        );
      return csv([
        ["Demo billing statement - not a tax invoice"],
        ["Period", s.period],
        ["Product", "Quantity", "Monthly INR", "Setup INR"],
        ...s.lines.map((l) => [
          l.product.name,
          l.quantity,
          l.monthlyPaise / 100,
          l.setupPaise / 100,
        ]),
        [
          "Total (excluding taxes)",
          "",
          s.monthlyPaise / 100,
          s.setupPaise / 100,
        ],
        ["First statement total INR", s.totalPaise / 100],
      ]);
    },
  );
  app.get<{ Params: { id: string } }>(
    "/api/v1/orders/:id/summary",
    async (req, reply) => {
      const row = store.db
        .select()
        .from(orders)
        .where(eq(orders.id, req.params.id))
        .get();
      if (!row || row.sessionId !== req.sessionId)
        staffError("not_found", "Order not found.", "ऑर्डर नहीं मिला।", 404);
      reply
        .type("text/csv; charset=utf-8")
        .header(
          "Content-Disposition",
          `attachment; filename="demo-order-${row.id}.csv"`,
        );
      return csv([
        ["Synthetic demo order", row.id],
        ["Status", row.data.status],
        ["Product", "Quantity", "Monthly INR", "Setup INR", "Contract months"],
        ...row.data.quote.lines.map((l) => [
          l.product.name,
          l.quantity,
          l.monthlyPaise / 100,
          l.setupPaise / 100,
          l.product.contractMonths,
        ]),
      ]);
    },
  );
  app.get("/api/v1/tickets", async (req) =>
    (
      store.sqlite
        .prepare("SELECT * FROM tickets WHERE session_id=?")
        .all(req.sessionId) as RecordRow[]
    ).map((r) => ({
      ...publicMessages(JSON.parse(r.data)),
      id: r.id,
      revision: r.revision,
      assignee: r.assignee,
    })),
  );
  app.post("/api/v1/tickets", async (req) => {
    const input = z
      .object({
        category: z.enum(["connectivity", "installation", "billing", "other"]),
        subject: z.string().trim().min(3).max(120),
        text: textSchema,
        requestId: z.string().uuid(),
      })
      .parse(req.body);
    if (!getOrder(req.sessionId))
      staffError(
        "order_required",
        "An order is required for support.",
        "सहायता के लिए ऑर्डर आवश्यक है।",
        400,
      );
    return store.db.transaction(() => {
      const existing = store.sqlite
        .prepare("SELECT * FROM tickets WHERE session_id=? AND request_id=?")
        .get(req.sessionId, input.requestId) as RecordRow | undefined;
      if (existing) return { id: existing.id };
      const id = randomUUID();
      const data: SupportTicket = {
        id,
        revision: 0,
        assignee: null,
        category: input.category,
        subject: input.subject,
        status: "open",
        messages: [message(input.requestId, "customer", input.text)],
        createdAt: now(),
      };
      store.sqlite
        .prepare(
          "INSERT INTO tickets(id,session_id,request_id,data) VALUES(?,?,?,?)",
        )
        .run(id, req.sessionId, input.requestId, JSON.stringify(data));
      return { id };
    });
  });
  app.post<{ Params: { id: string } }>(
    "/api/v1/tickets/:id/messages",
    async (req) => {
      const input = z
        .object({
          text: textSchema,
          reopen: z.boolean().default(false),
          revision: z.number().int(),
          requestId: z.string().uuid(),
        })
        .parse(req.body);
      return store.db.transaction(() => {
        const row = owned(
          store.sqlite
            .prepare("SELECT * FROM tickets WHERE id=?")
            .get(req.params.id) as RecordRow | undefined,
          req,
        );
        const data: SupportTicket = JSON.parse(row.data);
        if (data.messages.some((m) => m.id === input.requestId))
          return { ok: true };
        assertRevision(row, input.revision);
        if (data.status === "resolved" && !input.reopen)
          staffError(
            "ticket_resolved",
            "Reopen this ticket to reply.",
            "जवाब देने के लिए टिकट फिर खोलें।",
            409,
          );
        if (input.reopen || data.status === "waiting_customer")
          data.status = "open";
        data.messages.push(message(input.requestId, "customer", input.text));
        store.sqlite
          .prepare("UPDATE tickets SET data=?,revision=revision+1 WHERE id=?")
          .run(JSON.stringify(data), row.id);
        return { ok: true };
      });
    },
  );
  app.get("/api/v1/staff/tickets", async (req) => {
    const user = requireStaff(req);
    return (store.sqlite.prepare("SELECT * FROM tickets").all() as RecordRow[])
      .filter((r) => user.role === "operations" || r.assignee === user.id)
      .map((r) => ({
        ...JSON.parse(r.data),
        id: r.id,
        revision: r.revision,
        assignee: r.assignee,
        shop: sessionFor(store, r.session_id).profile?.businessName,
      }));
  });
  app.post<{ Params: { id: string } }>(
    "/api/v1/staff/tickets/:id",
    async (req) => {
      const input = payloadSchema.parse(req.body);
      return store.db.transaction(() => {
        const row = accessible(
          store.sqlite
            .prepare("SELECT * FROM tickets WHERE id=?")
            .get(req.params.id) as RecordRow | undefined,
          requireStaff(req),
        );
        const data: SupportTicket = JSON.parse(row.data);
        if (data.messages.some((m) => m.id === input.requestId))
          return { ok: true };
        assertRevision(row, input.revision);
        let assignee = row.assignee;
        if (input.action === "assign") {
          requireStaff(req, true);
          validAssignee(store, input.assignee);
          assignee = input.assignee ?? null;
        } else if (input.action === "status") {
          if (!input.status)
            staffError(
              "invalid_status",
              "Choose a ticket status.",
              "टिकट की स्थिति चुनें।",
              400,
            );
          if (data.status === "resolved")
            staffError(
              "ticket_resolved",
              "The customer must reopen this ticket.",
              "ग्राहक को टिकट फिर खोलना होगा।",
              409,
            );
          data.status = input.status;
        } else if (!["reply", "note"].includes(input.action))
          staffError(
            "invalid_action",
            "Choose a support action.",
            "सहायता कार्रवाई चुनें।",
            400,
          );
        data.messages.push(
          message(
            input.requestId,
            "staff",
            input.action === "assign"
              ? `Assigned: ${assignee || "operations"}`
              : textSchema.parse(input.text),
            ["assign", "note"].includes(input.action),
          ),
        );
        store.sqlite
          .prepare(
            "UPDATE tickets SET data=?,assignee=?,revision=revision+1 WHERE id=?",
          )
          .run(JSON.stringify(data), assignee, row.id);
        audit(store, req, row.session_id, `ticket.${input.action}`);
        return { ok: true };
      });
    },
  );
  app.get("/api/v1/staff/orders", async (req) => {
    const user = requireStaff(req);
    backfillServices(store);
    return store.db
      .select()
      .from(orders)
      .all()
      .map((row) => {
        const install = store.sqlite
          .prepare("SELECT * FROM installation WHERE order_id=?")
          .get(row.id) as RecordRow;
        return {
          id: row.id,
          order: row.data,
          shop: sessionFor(store, row.sessionId).profile?.businessName,
          installation: {
            ...JSON.parse(install.data),
            revision: install.revision,
            assignee: install.assignee,
          },
        };
      })
      .filter(
        (r) =>
          user.role === "operations" || r.installation.assignee === user.id,
      );
  });
  app.post<{ Params: { id: string } }>(
    "/api/v1/staff/orders/:id",
    async (req) => {
      const input = payloadSchema.parse(req.body);
      return store.db.transaction(() => {
        const install = accessible(
          store.sqlite
            .prepare(
              "SELECT *,order_id AS id FROM installation WHERE order_id=?",
            )
            .get(req.params.id) as RecordRow | undefined,
          requireStaff(req),
        );
        const row = store.db
          .select()
          .from(orders)
          .where(eq(orders.id, req.params.id))
          .get()!;
        const data = JSON.parse(install.data);
        if (data.messages.some((m: ServiceMessage) => m.id === input.requestId))
          return { ok: true };
        assertRevision(install, input.revision);
        let assignee = install.assignee;
        let order = row.data;
        if (input.action === "assign") {
          requireStaff(req, true);
          validAssignee(store, input.assignee);
          assignee = input.assignee ?? null;
        } else {
          let status = order.status;
          let type: "stage" | "delay" = "stage";
          if (
            input.action === "schedule" &&
            ["confirmed", "scheduled"].includes(status)
          ) {
            const start = z.iso.datetime({ offset: true }).parse(input.start),
              end = z.iso.datetime({ offset: true }).parse(input.end);
            if (
              Date.parse(start) < Date.now() - 60000 ||
              Date.parse(end) <= Date.parse(start)
            )
              staffError(
                "invalid_window",
                "Choose a future installation window.",
                "भविष्य की इंस्टॉलेशन अवधि चुनें।",
                400,
              );
            data.start = start;
            data.end = end;
            data.team = z.string().trim().min(2).max(100).parse(input.team);
            status = "scheduled";
          } else if (input.action === "start" && status === "scheduled")
            status = "installing";
          else if (input.action === "activate" && status === "installing")
            status = "activated";
          else if (
            input.action === "delay" &&
            ["scheduled", "installing"].includes(status)
          ) {
            data.delayReason = textSchema.parse(input.text);
            type = "delay";
            if (data.start)
              data.start = new Date(
                Date.parse(data.start) + 86400000,
              ).toISOString();
            if (data.end)
              data.end = new Date(
                Date.parse(data.end) + 86400000,
              ).toISOString();
            order = {
              ...order,
              estimates: order.estimates.map((e) => ({
                ...e,
                date: new Date(Date.parse(e.date) + 86400000).toISOString(),
              })),
            };
          } else
            staffError(
              "invalid_transition",
              "This installation transition is not allowed.",
              "यह इंस्टॉलेशन बदलाव अनुमत नहीं है।",
              409,
            );
          order = {
            ...order,
            status,
            events: [
              ...order.events,
              { id: randomUUID(), status, type, createdAt: now() },
            ],
          };
          store.db
            .update(orders)
            .set({ data: order })
            .where(eq(orders.id, order.id))
            .run();
          provisionServices(store, order, row.sessionId);
        }
        data.messages.push(message(input.requestId, "staff", input.action));
        store.sqlite
          .prepare(
            "UPDATE installation SET data=?,assignee=?,revision=revision+1 WHERE order_id=?",
          )
          .run(JSON.stringify(data), assignee, row.id);
        audit(store, req, row.sessionId, `installation.${input.action}`);
        return { ok: true };
      });
    },
  );
}
