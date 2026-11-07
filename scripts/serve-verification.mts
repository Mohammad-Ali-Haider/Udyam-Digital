// Dedicated in-memory verification server. Never used by npm start or real demo data.
import "../apps/server/src/config.js";
import { buildApp, serveWeb } from "../apps/server/src/app.js";
import { openDatabase } from "../apps/server/src/db.js";
delete process.env.OPENROUTER_API_KEY;
process.env.STAFF_OPERATIONS_PASSWORD = "verification-operations-only";
process.env.STAFF_PARTNER_A_PASSWORD = "verification-partner-only";
process.env.STAFF_PARTNER_B_PASSWORD = "verification-partner-b-only";
const store = openDatabase(":memory:");
const { app } = await buildApp({ store });
await serveWeb(app);
await app.listen({ host: "127.0.0.1", port: 3003 });
console.log(
  "Isolated verification server on 127.0.0.1:3003 (AI fallback only).",
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, async () => {
    await app.close();
    store.sqlite.close();
    process.exit(0);
  });
