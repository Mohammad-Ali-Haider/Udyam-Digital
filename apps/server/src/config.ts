import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { config } from "dotenv";

export const serverRoot = fileURLToPath(new URL("../", import.meta.url));
export const workspaceRoot = resolve(serverRoot, "../..");
config({ path: resolve(serverRoot, ".env"), quiet: true });
export const runtimeRoot = resolve(workspaceRoot, ".runtime");
export const port = Number(process.env.PORT || 3001);
