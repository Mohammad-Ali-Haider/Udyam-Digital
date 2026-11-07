import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, ".."),
  path = resolve(root, "apps/server/.env");
let content = existsSync(path) ? readFileSync(path, "utf8") : "";
const accounts = [
  ["operations", "STAFF_OPERATIONS_PASSWORD"],
  ["partner-a", "STAFF_PARTNER_A_PASSWORD"],
  ["partner-b", "STAFF_PARTNER_B_PASSWORD"],
];
const access = [
  "Local demo staff access — private, do not commit or share publicly.",
  "Open http://localhost:3001/staff after starting the backend.",
];
for (const [name, key] of accounts) {
  const match = content.match(new RegExp(`^${key}=(.*)$`, "m"));
  let value = match?.[1]?.trim().replace(/^['"]|['"]$/g, "");
  if (!value || value.length < 12) {
    value = randomBytes(18).toString("base64url");
    const line = `${key}=${value}`;
    content = match ? content.replace(match[0], line) : content + "\n" + line;
  }
  access.push(`${name}: ${value}`);
}
writeFileSync(path, content.trimEnd() + "\n");
mkdirSync(resolve(root, ".runtime"), { recursive: true });
writeFileSync(
  resolve(root, ".runtime/demo-staff-access.txt"),
  access.join("\n") + "\n",
);
console.log(
  "Staff passwords configured in ignored apps/server/.env. View .runtime/demo-staff-access.txt locally. Restart the backend to apply.",
);
