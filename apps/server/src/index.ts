import { buildApp, serveWeb } from "./app.js";
import { port } from "./config.js";
const { app } = await buildApp({ logger: true });
await serveWeb(app);
await app.listen({ host: process.env.HOST || "0.0.0.0", port });
console.log(`Udyam Digital is available at http://localhost:${port}`);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
