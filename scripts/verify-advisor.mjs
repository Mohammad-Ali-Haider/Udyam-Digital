import { chromium, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3003";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "no-preference",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const fixture = JSON.parse(
  readFileSync("apps/server/tests/fixtures/demo-profile.json", "utf8"),
);
mkdirSync("artifacts/screenshots", { recursive: true });
const button = (name) => page.getByRole("button", { name, exact: true });
async function send(text) {
  const input = page.getByRole("textbox", {
    name: "Tell your advisor…",
    exact: true,
  });
  await expect(input).toBeEnabled();
  await input.fill(text);
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/advisor/messages") && r.request().method() === "POST",
  );
  await button("Send message").press("Enter");
  expect((await response).status()).toBe(200);
  await expect(input).toHaveValue("");
  await expect(input).toBeEnabled();
  await expect(
    page.getByText("Updating your cart…", { exact: true }),
  ).toHaveCount(0);
}
async function capture(name) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
  ).toBe(false);
  await page.screenshot({
    path: `artifacts/screenshots/${name}.png`,
    fullPage: true,
  });
}
try {
  const session = await context.request.post(base + "/api/v1/sessions", {
    headers: { origin: base },
    data: { platform: "web" },
  });
  expect(session.status()).toBe(200);
  const profile = await context.request.patch(base + "/api/v1/profile", {
    headers: { origin: base },
    data: { profile: fixture.profile, revision: 0 },
  });
  expect(profile.status()).toBe(200);
  await page.goto(base + "/advisor");
  await expect(page.getByTestId("cart-monthly")).toHaveText("₹1,598");
  await expect(
    page.getByRole("textbox", { name: "Tell your advisor…", exact: true }),
  ).toBeVisible();
  await capture("advisor-redesign-desktop");
  await send("Billing essential, CCTV optional");
  await expect(page.getByTestId("cart-item-P23")).toBeVisible();
  await expect(page.getByTestId("cart-update")).toContainText("1 added");
  const withCctv = await page.getByTestId("cart-monthly").innerText();
  expect(withCctv).not.toBe("₹1,598");
  await capture("advisor-cart-added");
  await send("Make it cheaper");
  await expect(page.getByTestId("cart-item-P23")).toHaveCount(0);
  await expect(page.getByTestId("cart-monthly")).toHaveText("₹1,598");
  await expect(page.getByTestId("cart-update")).toContainText("1 removed");
  for (const text of [
    "Phone hotspot",
    "Fibre is available",
    "I need new billing software",
  ])
    await send(text);
  await expect(button("Review this cart")).toBeEnabled();
  await send("Add CCTV as optional");
  const choose = page.waitForResponse(
    (r) => r.url().endsWith("/quotes") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: /^Essential ·/ }).press("Enter");
  expect((await choose).status()).toBe(200);
  await expect(page.getByTestId("cart-monthly")).toHaveText("₹1,598");
  await page.reload();
  await expect(page.getByTestId("cart-monthly")).toHaveText("₹1,598");
  await send("Why do I need this?");
  await expect(page.getByTestId("cart-monthly")).toHaveText("₹1,598");
  await button("Back to cart").press("Enter");
  await expect(button("Ask Udyam")).toBeVisible();
  await expect(button("Ask Udyam")).toBeFocused();
  await button("Back to business").press("Enter");
  await expect(page).toHaveURL(/\/business$/);
  await page.goBack();
  for (const width of [360, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.reload();
    await expect(page.getByTestId("cart-monthly")).toHaveText("₹1,598");
    if (width >= 1024) {
      await capture("advisor-split-1024");
      await button("Back to cart").press("Enter");
    }
    await capture(`advisor-cart-${width}`);
    await button("Ask Udyam").press("Enter");
    await expect(
      page.getByRole("textbox", { name: "Tell your advisor…", exact: true }),
    ).toBeVisible();
    await expect(button("Back to cart")).toBeInViewport({ ratio: 1 });
    await capture(`advisor-chat-${width}`);
    await page.keyboard.press("Escape");
    await expect(button("Ask Udyam")).toBeVisible();
    await expect(button("Ask Udyam")).toBeFocused();
  }
  await page.setViewportSize({ width: 360, height: 900 });
  await button("Ask Udyam").press("Enter");
  await send("Add CCTV as optional");
  await button("Back to cart").press("Enter");
  await expect(page.getByTestId("cart-item-P23")).toBeVisible();
  await capture("advisor-mobile-cart-added");
  await button("Ask Udyam").press("Enter");
  await send("Make it cheaper");
  await button("Back to cart").press("Enter");
  await expect(page.getByTestId("cart-item-P23")).toHaveCount(0);
  await expect(page.getByTestId("cart-monthly")).toHaveText("₹1,598");
  await button("Ask Udyam").press("Enter");
  await page
    .getByRole("textbox", { name: "Tell your advisor…", exact: true })
    .fill("Keep this unsent question");
  await button("Back to cart").press("Enter");
  await page.reload();
  await button("Ask Udyam").press("Enter");
  await expect(
    page.getByRole("textbox", { name: "Tell your advisor…", exact: true }),
  ).toHaveValue("Keep this unsent question");
  await page.route("**/api/v1/advisor/messages", (r) => r.abort());
  await button("Send message").press("Enter");
  await expect(page.getByRole("alert").first()).toBeVisible();
  await button("Back to cart").press("Enter");
  await page.unroute("**/api/v1/advisor/messages");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(button("Retry")).toHaveCount(1);
  const [retry] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().endsWith("/advisor/messages") &&
        r.request().method() === "POST",
    ),
    button("Retry").press("Enter"),
  ]);
  expect(retry.status()).toBe(200);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await button("Ask Udyam").press("Enter");
  await send("Budget 500");
  await button("Back to cart").press("Enter");
  await expect(page.getByText(/over budget —/)).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await button("Ask Udyam").press("Enter");
  await send("Remove billing");
  await button("Back to cart").press("Enter");
  await expect(page.getByTestId("cart-item-P19")).toHaveCount(0);
  await expect(page.getByTestId("cart-monthly")).toHaveText("₹999");
  await page.goto(base + "/settings");
  await button("Light").press("Enter");
  await button("हिन्दी").last().press("Enter");
  await page.goto(base + "/advisor");
  await capture("advisor-cart-hindi-light");
  await button("Udyam से पूछें").press("Enter");
  await expect(button("कार्ट पर वापस")).toBeInViewport({ ratio: 1 });
  await capture("advisor-chat-hindi-light");
  expect(errors).toEqual([]);
  console.log(
    "PASS: live cart add/remove, cheaper plan, option persistence, back actions, mobile chat, saved draft, backend failure, budget warning, reduced motion, Hindi/light and 360/768/1024/1440 layouts.",
  );
} catch (e) {
  await page.screenshot({
    path: "artifacts/screenshots/advisor-redesign-failure.png",
    fullPage: true,
  });
  throw e;
} finally {
  await browser.close();
}
