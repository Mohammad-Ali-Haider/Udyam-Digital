import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3003";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const customer = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  }),
  staffContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
const page = await customer.newPage(),
  staff = await staffContext.newPage();
const errors = [];
for (const p of [page, staff]) p.on("pageerror", (e) => errors.push(e.message));
const output = resolve("artifacts/screenshots");
await mkdir(output, { recursive: true });
const click = (p, name) =>
  p.getByRole("button", { name, exact: true }).press("Enter");
async function capture(p, name) {
  await expect(p.getByRole("heading").first()).toBeVisible();
  await expect(p.getByRole("progressbar")).toHaveCount(0);
  await p.screenshot({ path: resolve(output, name + ".png"), fullPage: true });
  expect(
    await p.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    name + " overflow",
  ).toBe(false);
}
async function action(p, name) {
  const response = p.waitForResponse(
    (r) => r.request().method() === "POST" && r.url().includes("/api/v1/"),
  );
  await click(p, name);
  const r = await response;
  expect(r.status(), await r.text()).toBe(200);
}
try {
  await page.goto(base);
  await click(page, "Get started");
  await click(page, "Use sample kirana");
  await expect(
    page.getByRole("textbox", { name: "Shop name", exact: true }),
  ).toHaveValue("Shree General Store");
  await click(page, "Meet your advisor");
  for (const answer of [
    "Billing essential, CCTV optional",
    "Phone hotspot",
    "Fibre is available",
    "I need new billing software",
    "Make it cheaper",
  ]) {
    await page
      .getByRole("textbox", { name: "Tell your advisor…", exact: true })
      .fill(answer);
    await action(page, "Send message");
  }
  await expect(
    page.getByRole("button", { name: "Choose this bundle", exact: true }),
  ).toHaveCount(1);
  await capture(page, "advisor-desktop");
  await click(page, "Get help from a partner");
  await page
    .getByRole("textbox", { name: "What do you need help with?", exact: true })
    .fill("Please help me keep this affordable.");
  await page
    .getByRole("checkbox", {
      name: "I agree to share this journey for assistance",
      exact: true,
    })
    .press("Space");
  await action(page, "Request assistance");
  await staff.goto(base + "/staff");
  expect(
    (await staffContext.cookies()).some((c) => c.name === "udyam_session"),
  ).toBe(false);
  await staff
    .getByLabel("Password", { exact: true })
    .fill("verification-operations-only");
  await action(staff, "Sign in");
  await click(staff, "Open case");
  await click(staff, "partner-a");
  await action(staff, "Assign selected staff member");
  await action(staff, "Sign out");
  await staff
    .getByRole("textbox", { name: "Username", exact: true })
    .fill("partner-a");
  await staff
    .getByLabel("Password", { exact: true })
    .fill("verification-partner-only");
  await action(staff, "Sign in");
  await click(staff, "Open case");
  await staff
    .getByRole("textbox", { name: "Message / reason", exact: true })
    .fill("Keep billing and internet; optional extras can wait.");
  await action(staff, "Reply to customer");
  await expect(
    page.getByText("Keep billing and internet; optional extras can wait.", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 15000 });
  await capture(staff, "staff-assistance-desktop");
  await action(page, "Choose this bundle");
  await click(page, "Review your quote");
  await page
    .getByRole("checkbox", { name: /I accept this quote/ })
    .press("Space");
  await action(page, "Accept & verify business");
  await page
    .getByRole("checkbox", { name: /I consent to processing/ })
    .press("Space");
  await action(page, "Agree & continue");
  await page
    .getByRole("button", { name: "Use synthetic sample", exact: true })
    .nth(0)
    .press("Enter");
  await expect(page.getByText("Verified", { exact: true })).toHaveCount(1, {
    timeout: 45000,
  });
  await click(page, "Try expired sample");
  await expect(
    page.getByText("Replacement needed", { exact: true }),
  ).toBeVisible({ timeout: 45000 });
  await capture(page, "kyc-correction-desktop");
  const chooserPromise = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Replace file", exact: true })
    .nth(1)
    .press("Enter");
  await (
    await chooserPromise
  ).setFiles(resolve("apps/server/tests/fixtures/demo-address.png"));
  await expect(page.getByText("Verified", { exact: true })).toHaveCount(2, {
    timeout: 45000,
  });
  await page
    .getByRole("button", { name: "Use synthetic sample", exact: true })
    .nth(2)
    .press("Enter");
  await expect(
    page.getByRole("button", { name: "Confirm demo order", exact: true }),
  ).toBeEnabled({ timeout: 45000 });
  await action(page, "Confirm demo order");
  await expect(
    page.getByRole("button", { name: "Advance demo stage", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByText("Order reference", { exact: false }),
  ).toBeVisible();
  await action(staff, "Sign out");
  await staff
    .getByRole("textbox", { name: "Username", exact: true })
    .fill("operations");
  await staff
    .getByLabel("Password", { exact: true })
    .fill("verification-operations-only");
  await action(staff, "Sign in");
  await click(staff, "Installation");
  await click(staff, "Open case");
  await action(staff, "Schedule installation");
  await staff
    .getByRole("textbox", { name: "Message / reason", exact: true })
    .fill("Demo equipment delay");
  await action(staff, "Report delay (+1 day)");
  await expect(
    page.getByText(/Delay explanation: Demo equipment delay/),
  ).toBeVisible({ timeout: 15000 });
  await action(staff, "Start installation");
  await action(staff, "Complete simulated activation");
  await expect(
    page.getByRole("button", { name: "View your services", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await capture(page, "tracker-desktop");
  await click(page, "View your services");
  await expect(
    page.getByText("Your shop, connected.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Your shop, connected.", { exact: true }),
  ).toBeVisible();
  await page.goto(base + "/bills");
  await expect(
    page.getByText("Total excluding taxes: ₹4,098", { exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await click(page, "Download CSV");
  expect((await download).suggestedFilename()).toContain(".csv");
  await capture(page, "billing-desktop");
  const printPage = page.waitForEvent("popup");
  await click(page, "Print statement");
  const printable = await printPage;
  await expect(
    printable.getByRole("heading", {
      name: "Demo billing statement — not a tax invoice",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    printable.getByText("Total excluding taxes: ₹4,098", { exact: true }),
  ).toBeVisible();
  await printable.close();
  await page.goto(base + "/support");
  await page
    .getByRole("textbox", { name: "Subject", exact: true })
    .fill("Setup charge question");
  await page
    .getByRole("textbox", { name: "Describe the issue", exact: true })
    .fill("Why is setup on this statement?");
  await action(page, "Create ticket");
  await expect(
    page.getByRole("textbox", { name: "Subject", exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByRole("textbox", { name: "Subject", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("textbox", { name: "Subject", exact: true })
    .fill("Unsent draft survives refresh");
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Subject", exact: true }),
  ).toHaveValue("Unsent draft survives refresh");
  await page.getByRole("textbox", { name: "Subject", exact: true }).fill("");
  await click(staff, "Support tickets");
  await click(staff, "Open case");
  await staff
    .getByRole("textbox", { name: "Message / reason", exact: true })
    .fill("Setup is included once in the first statement.");
  await action(staff, "Resolve with message");
  await expect(page.getByText("Resolved", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  await page
    .getByRole("textbox", { name: "Reason to reopen", exact: true })
    .fill("Please confirm the monthly amount too.");
  await action(page, "Reopen ticket");
  await expect(page.getByText("Open", { exact: true })).toBeVisible();
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await staff.setViewportSize({ width, height: 1000 });
    await capture(page, `support-${width}`);
    await capture(staff, `staff-${width}`);
    await page.goto(base + "/home");
    await capture(page, `home-${width}`);
    await page.goto(base + "/support");
  }
  await page.goto(base + "/settings");
  await click(page, "System");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.getByText("Appearance", { exact: true })).toHaveCSS(
    "color",
    "rgb(245, 246, 247)",
  );
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.getByText("Appearance", { exact: true })).toHaveCSS(
    "color",
    "rgb(23, 25, 29)",
  );
  await page.reload();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("udyam.preferences")).theme,
    ),
  ).toBe("system");
  await click(page, "Light");
  await page
    .getByRole("button", { name: "हिन्दी", exact: true })
    .last()
    .press("Enter");
  await page.goto(base + "/home");
  await expect(
    page.getByText("आपकी दुकान, अब जुड़ी हुई।", { exact: true }),
  ).toBeVisible();
  await capture(page, "home-hindi-light");
  await staff.goto(base + "/staff/preferences");
  await click(staff, "Light");
  await staff
    .getByRole("button", { name: "हिन्दी", exact: true })
    .last()
    .press("Enter");
  await staff.goto(base + "/staff");
  await capture(staff, "staff-hindi-light");
  const revoke = await staffContext.request.post(
    base + "/api/v1/staff/auth/logout",
    { headers: { origin: base } },
  );
  expect(revoke.status()).toBe(200);
  await expect(
    staff.getByRole("textbox", { name: "यूज़रनेम", exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await page.route("**/api/v1/**", (r) => r.abort());
  await page.reload();
  await expect(page.getByRole("alert").first()).toBeVisible({ timeout: 20000 });
  await page.unroute("**/api/v1/**");
  await page.reload();
  await expect(
    page.getByText("आपकी दुकान, अब जुड़ी हुई।", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    "PASS: connected customer/staff journey, real OCR replacement, saved drafts, printable/CSV statements, support reopen, 360/768/1024/1440 widths, Hindi, Dark/Light/System, revoked staff session and reconnect.",
  );
} catch (error) {
  await capture(page, "failure-customer");
  await capture(staff, "failure-staff");
  throw error;
} finally {
  await browser.close();
}
