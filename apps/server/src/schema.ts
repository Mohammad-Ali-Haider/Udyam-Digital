import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import type {
  BusinessProfile,
  Message,
  Selection,
  Quote,
  Order,
  Language,
} from "@udyam/shared";

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  transport: text("transport").notNull(),
  updatedAt: integer("updated_at").notNull(),
  revision: integer("revision").notNull().default(0),
  profile: text("profile", { mode: "json" }).$type<BusinessProfile | null>(),
  messages: text("messages", { mode: "json" })
    .$type<Message[]>()
    .notNull()
    .default([]),
  recommendation: text("recommendation", { mode: "json" })
    .$type<Selection>()
    .notNull()
    .default([]),
  advisorStep: integer("advisor_step").notNull().default(0),
  consent: text("consent", { mode: "json" }).$type<{
    version: string;
    language: Language;
    at: string;
  } | null>(),
});
export const quotes = sqliteTable("quotes", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  revision: integer("revision").notNull(),
  data: text("data", { mode: "json" }).$type<Quote>().notNull(),
  current: integer("current", { mode: "boolean" }).notNull().default(true),
});
export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  status: text("status").notNull(),
  fields: text("fields", { mode: "json" })
    .$type<Record<string, string>>()
    .notNull(),
  issues: text("issues", { mode: "json" }).$type<string[]>().notNull(),
  evidence: text("evidence", { mode: "json" })
    .$type<Record<string, string>>()
    .notNull(),
  createdAt: text("created_at").notNull(),
});
export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  quoteId: text("quote_id").notNull().unique(),
  idempotencyKey: text("idempotency_key").notNull(),
  data: text("data", { mode: "json" }).$type<Order>().notNull(),
});
