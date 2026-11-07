import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { runtimeRoot, serverRoot } from "./config.js";
import * as schema from "./schema.js";

export function openDatabase(path = resolve(runtimeRoot, "udyam.sqlite")) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(
    readFileSync(resolve(serverRoot, "drizzle/0000_initial.sql"), "utf8"),
  );
  sqlite
    .prepare(
      "UPDATE documents SET status = 'replacement_needed', issues = ? WHERE status = 'processing'",
    )
    .run(JSON.stringify(["processing_interrupted"]));
  return { db: drizzle(sqlite, { schema }), sqlite };
}
export type Store = ReturnType<typeof openDatabase>;
