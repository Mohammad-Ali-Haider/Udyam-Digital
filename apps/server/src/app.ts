import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import staticFiles from "@fastify/static";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { eq, lt, and, desc } from "drizzle-orm";
import { ZodError, z } from "zod";
import { profileSchema } from "@udyam/shared";
import { openDatabase, type Store } from "./db.js";
import { sessions, quotes, documents, orders } from "./schema.js";
import { DomainError, products } from "./catalogue.js";
import { workspaceRoot } from "./config.js";
import { registerWorkflow } from "./workflow.js";

declare module "fastify" {
  interface FastifyRequest {
    sessionId: string;
  }
}
const lifetime = 7 * 86400 * 1000;
const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export function sessionFor(store: Store, id: string) {
  const session = store.db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))
    .get();
  if (!session)
    throw new DomainError(
      "session_expired",
      "सत्र समाप्त हो गया। नया सत्र शुरू करें।",
      "Session expired. Start a new session.",
      401,
    );
  return session;
}
export function currentQuote(store: Store, id: string) {
  return (
    store.db
      .select()
      .from(quotes)
      .where(and(eq(quotes.sessionId, id), eq(quotes.current, true)))
      .get()?.data || null
  );
}
export function ensureEditable(store: Store, id: string) {
  if (store.db.select().from(orders).where(eq(orders.sessionId, id)).get())
    throw new DomainError(
      "order_locked",
      "यह ऑर्डर पूरा हो चुका है। नया डेमो शुरू करें।",
      "This journey already has an order. Start a new demo.",
      409,
    );
}
export async function buildApp(
  options: { store?: Store; logger?: boolean } = {},
) {
  const store = options.store || openDatabase();
  const app = Fastify({
    logger: options.logger
      ? {
          redact: [
            "req.headers.authorization",
            "req.headers.cookie",
            "res.headers.set-cookie",
          ],
        }
      : false,
    bodyLimit: 11 * 1024 * 1024,
    disableRequestLogging: true,
  });
  app.decorateRequest("sessionId", "");
  const allowed = (
    process.env.WEB_ORIGINS || "http://localhost:8081,http://localhost:3001"
  ).split(",");
  await app.register(cookie);
  await app.register(cors, { origin: allowed, credentials: true });
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 4 },
  });
  app.setErrorHandler((error, req, reply) => {
    if (error instanceof ZodError)
      return reply
        .code(400)
        .send({
          code: "invalid_input",
          message: "Check the highlighted fields.",
          messageHi: "दर्ज जानकारी जाँचें।",
          retryable: false,
          fields: Object.fromEntries(
            error.issues.map((i) => [i.path.join("."), i.message]),
          ),
        });
    if (error instanceof DomainError)
      return reply
        .code(error.status)
        .send({
          code: error.code,
          message: error.message,
          messageHi: error.messageHi,
          retryable: error.status >= 500,
        });
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status < 500)
      return reply
        .code(status)
        .send({
          code: "invalid_request",
          message:
            "The request could not be processed. Check the file and try again.",
          messageHi: "अनुरोध पूरा नहीं हुआ। फ़ाइल जाँचकर फिर कोशिश करें।",
          retryable: false,
        });
    app.log.error({ name: (error as Error).name }, "Request failed");
    return reply
      .code(500)
      .send({
        code: "server_error",
        message: "Something went wrong. Please retry.",
        messageHi: "कुछ गड़बड़ हुई। फिर कोशिश करें।",
        retryable: true,
      });
  });
  app.addHook("preHandler", async (req, reply) => {
    const path = req.url.split("?")[0];
    if (path.startsWith("/api/")) reply.header("Cache-Control", "no-store");
    if (
      !path.startsWith("/api/v1/") ||
      path === "/api/v1/health" ||
      req.method === "OPTIONS"
    )
      return;
    const origin = req.headers.origin;
    const ownOrigin = `${req.protocol}://${req.headers.host}`;
    if (origin && !allowed.includes(origin) && origin !== ownOrigin)
      throw new DomainError(
        "origin_denied",
        "यह स्रोत अनुमत नहीं है।",
        "Origin is not allowed.",
        403,
      );
    if (path === "/api/v1/sessions" && req.method === "POST") return;
    const bearer = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : undefined;
    const token = bearer || req.cookies.udyam_session;
    if (!token)
      throw new DomainError(
        "session_required",
        "सत्र शुरू करें।",
        "Start a session.",
        401,
      );
    const session = store.db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, hash(token)))
      .get();
    if (
      !session ||
      session.updatedAt < Date.now() - lifetime ||
      session.transport !== (bearer ? "native" : "web")
    ) {
      if (session)
        store.db.delete(sessions).where(eq(sessions.id, session.id)).run();
      throw new DomainError(
        "session_expired",
        "सत्र समाप्त हो गया। नया सत्र शुरू करें।",
        "Session expired. Start a new session.",
        401,
      );
    }
    if (
      !bearer &&
      !["GET", "HEAD"].includes(req.method) &&
      origin !== ownOrigin &&
      !allowed.includes(origin || "")
    )
      throw new DomainError(
        "origin_required",
        "अनुरोध स्रोत जाँच विफल हुई।",
        "An allowed origin is required.",
        403,
      );
    req.sessionId = session.id;
    store.db
      .update(sessions)
      .set({ updatedAt: Date.now() })
      .where(eq(sessions.id, session.id))
      .run();
    if (!bearer)
      reply.setCookie("udyam_session", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: req.protocol === "https",
        path: "/",
        maxAge: lifetime / 1000,
      });
  });
  app.post("/api/v1/sessions", async (req, reply) => {
    const { platform } = z
      .object({ platform: z.enum(["web", "native"]) })
      .parse(req.body);
    store.db
      .delete(sessions)
      .where(lt(sessions.updatedAt, Date.now() - lifetime))
      .run();
    const token = randomBytes(32).toString("base64url");
    store.db
      .insert(sessions)
      .values({
        id: randomUUID(),
        tokenHash: hash(token),
        transport: platform,
        updatedAt: Date.now(),
        messages: [],
        recommendation: [],
      })
      .run();
    if (platform === "web")
      reply.setCookie("udyam_session", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: req.protocol === "https",
        path: "/",
        maxAge: lifetime / 1000,
      });
    reply.header("Cache-Control", "no-store");
    return platform === "native" ? { token } : { created: true };
  });
  app.get("/api/v1/health", async () => {
    store.sqlite.prepare("SELECT 1").get();
    return {
      status: "ok",
      aiConfigured: Boolean(process.env.OPENROUTER_API_KEY),
      provider: "openrouter",
    };
  });
  app.get("/api/v1/catalogue", async () => products);
  app.patch("/api/v1/profile", async (req) => {
    ensureEditable(store, req.sessionId);
    const { profile, revision } = z
      .object({ profile: profileSchema, revision: z.number().int() })
      .parse(req.body);
    const current = sessionFor(store, req.sessionId);
    if (revision !== current.revision)
      throw new DomainError(
        "stale_revision",
        "जानकारी बदली है। ताज़ा करके फिर कोशिश करें।",
        "The profile changed. Refresh and retry.",
        409,
      );
    const identityChanged =
      current.profile &&
      ["businessName", "signatoryName", "address", "city", "state"].some(
        (k) =>
          current.profile![k as keyof typeof profile] !==
          profile[k as keyof typeof profile],
      );
    const serviceChanged =
      current.profile &&
      JSON.stringify({ ...current.profile, language: "en" }) !==
        JSON.stringify({ ...profile, language: "en" });
    store.db.transaction((tx) => {
      tx.update(sessions)
        .set({
          profile,
          revision: revision + 1,
          ...(serviceChanged
            ? { recommendation: [], messages: [], advisorStep: 0 }
            : {}),
          ...(identityChanged ? { consent: null } : {}),
        })
        .where(eq(sessions.id, req.sessionId))
        .run();
      if (serviceChanged)
        tx.update(quotes)
          .set({ current: false })
          .where(eq(quotes.sessionId, req.sessionId))
          .run();
      if (identityChanged)
        tx.delete(documents)
          .where(eq(documents.sessionId, req.sessionId))
          .run();
    });
    return { revision: revision + 1 };
  });
  app.delete("/api/v1/session", async (req, reply) => {
    store.db.delete(sessions).where(eq(sessions.id, req.sessionId)).run();
    reply.clearCookie("udyam_session", { path: "/" });
    return { deleted: true };
  });
  const expiryTimer = setInterval(
    () =>
      store.db
        .delete(sessions)
        .where(lt(sessions.updatedAt, Date.now() - lifetime))
        .run(),
    60 * 60 * 1000,
  );
  expiryTimer.unref();
  const ocr = await registerWorkflow(app, store);
  app.addHook("onClose", async () => {
    clearInterval(expiryTimer);
    await ocr.close();
    if (!options.store) store.sqlite.close();
  });
  return { app, store };
}

export async function serveWeb(
  app: Awaited<ReturnType<typeof buildApp>>["app"],
) {
  const root = resolve(workspaceRoot, "apps/client/dist");
  if (!existsSync(resolve(root, "index.html"))) return;
  await app.register(staticFiles, { root });
  app.setNotFoundHandler((req, reply) => {
    if (
      req.method === "GET" &&
      /^\/(?:language|business|advisor|bundle|checkout|kyc|settings|orders\/[\w-]+)?\/?$/.test(
        req.url.split("?")[0],
      )
    )
      return reply.sendFile("index.html");
    return reply.code(404).send({ code: "not_found" });
  });
}
