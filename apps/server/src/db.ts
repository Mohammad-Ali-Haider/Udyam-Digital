import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync, readFileSync, readdirSync, existsSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { runtimeRoot, serverRoot } from "./config.js";
import * as schema from "./schema.js";

export function openDatabase(path = resolve(runtimeRoot, "udyam.sqlite")) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  const migrationDir = resolve(serverRoot, "drizzle");
  const oldVersion = sqlite.pragma("user_version", { simple: true }) as number;
  if(path !== ":memory:" && oldVersion < 2 && sqlite.prepare("SELECT name FROM sqlite_master WHERE name='sessions'").get()) {
    sqlite.pragma("wal_checkpoint(TRUNCATE)");
    const backup = `${path}.before-services-backup`;
    if(!existsSync(backup)) copyFileSync(path, backup);
  }
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");
  const migrations = readdirSync(migrationDir).filter(n=>/^\d+.*\.sql$/.test(n)).sort();
  migrations.forEach((file,index)=>{
    if(index >= oldVersion) sqlite.transaction(()=>{
      sqlite.exec(readFileSync(resolve(migrationDir,file),"utf8"));
      sqlite.pragma(`user_version = ${index+1}`);
    })();
  });
  sqlite
    .prepare(
      "UPDATE documents SET status = 'replacement_needed', issues = ? WHERE status = 'processing'",
    )
    .run(JSON.stringify(["processing_interrupted"]));
  return { db: drizzle(sqlite, { schema }), sqlite };
}
export type Store = ReturnType<typeof openDatabase>;
