import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  viewport: { width: Number(process.env.TEST_WIDTH || 1440), height: 1000 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const output = resolve("artifacts/screenshots");
await mkdir(output, { recursive: true });
const origin = process.env.TEST_BASE_URL || "http://127.0.0.1:3001";
async function capture(name) {
  await page.screenshot({
    path: resolve(output, `${name}.png`),
    fullPage: true,
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflow, `Horizontal overflow on ${name}`).toBe(false);
}
try {
  await page.goto(origin);
  await expect(
    page.getByRole("button", { name: "Get started", exact: true }),
  ).toBeVisible();
  await capture("welcome-desktop");
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe(
    "BODY",
  );
  await page
    .getByRole("button", { name: "Get started", exact: true })
    .press("Enter");
  await page
    .getByRole("button", { name: "Use sample kirana", exact: true })
    .press("Enter");
  await expect(
    page.getByRole("textbox", { name: "Shop name", exact: true }),
  ).toHaveValue("Shree General Store");
  await capture("profile-desktop");
  await page
    .getByRole("button", { name: "Meet your advisor", exact: true })
    .press("Enter");
  for (const answer of [
    "Reliable internet",
    "Phone hotspot",
    "Yes",
    "Yes, include billing",
    "Keep it simple",
    "Recommend my bundle",
  ]) {
    await page
      .getByRole("button", { name: answer, exact: true })
      .press("Enter");
  }
  await capture("advisor-desktop");
  await page
    .getByRole("button", { name: "See your recommended bundle", exact: true })
    .press("Enter");
  await expect(
    page.getByRole("button", { name: "Review your quote", exact: true }),
  ).toBeEnabled();
  await capture("bundle-desktop");
  await page
    .getByRole("button", { name: "Review your quote", exact: true })
    .press("Enter");
  await page
    .getByRole("checkbox", { name: /I accept this quote/ })
    .press("Space");
  await expect(
    page.getByRole("button", { name: "Accept & verify business", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Accept & verify business", exact: true })
    .press("Enter");
  await page
    .getByRole("checkbox", { name: /I consent to processing/ })
    .press("Space");
  await expect(
    page.getByRole("button", { name: "Agree & continue", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Agree & continue", exact: true })
    .press("Enter");
  await page
    .getByRole("button", { name: "Use synthetic sample", exact: true })
    .nth(0)
    .press("Enter");
  await expect(page.getByText("Verified", { exact: true })).toHaveCount(1, {
    timeout: 45000,
  });
  await page
    .getByRole("button", { name: "Try expired sample", exact: true })
    .press("Enter");
  await expect(
    page.getByText("Replacement needed", { exact: true }),
  ).toBeVisible({ timeout: 45000 });
  await capture("kyc-correction-desktop");
  const chooserPromise = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Replace file", exact: true })
    .nth(1)
    .press("Enter");
  const chooser = await chooserPromise;
  await chooser.setFiles(
    resolve("apps/server/tests/fixtures/demo-address.png"),
  );
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
  await page
    .getByRole("button", { name: "Confirm demo order", exact: true })
    .press("Enter");
  await expect(
    page.getByRole("button", { name: "Advance demo stage", exact: true }),
  ).toBeVisible();
  const orderUrl = page.url();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Advance demo stage", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Simulate 1-day delay", exact: true })
    .press("Enter");
  await expect(
    page.getByText("Installation estimate moved by one day", { exact: true }),
  ).toBeVisible();
  for (let i = 0; i < 3; i++) {
    const advance = page.getByRole("button", {
      name: "Advance demo stage",
      exact: true,
    });
    await expect(advance).toBeEnabled();
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/advance") &&
        response.request().method() === "POST",
    );
    await advance.press("Enter");
    await responsePromise;
  }
  await expect(
    page.getByRole("button", { name: "Advance demo stage", exact: true }),
  ).toBeDisabled();
  await capture("tracker-desktop");
  for (const width of [768, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await capture(`tracker-${width}`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Settings", exact: true })
    .last()
    .press("Enter");
  await page.getByRole("button", { name: "Light", exact: true }).press("Enter");
  await page
    .getByRole("button", { name: "हिन्दी", exact: true })
    .last()
    .press("Enter");
  await page.reload();
  await capture("settings-hindi-light");
  await page.goto(orderUrl);
  await expect(
    page.getByText("आपकी दुकान तैयार है।", { exact: true }),
  ).toBeVisible();
  await capture("tracker-hindi-light");
  await page.route("**/api/v1/**", (route) => route.abort());
  await page.reload();
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 20000 });
  await page.unroute("**/api/v1/**");
  await page.reload();
  await expect(
    page.getByText("आपकी दुकान तैयार है।", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    "PASS: keyboard-operated onboarding, real upload/OCR correction, order persistence, activation, responsive widths, Hindi/light preference persistence, and network recovery.",
  );
} catch (error) {
  await capture("failure");
  throw error;
} finally {
  await browser.close();
}
