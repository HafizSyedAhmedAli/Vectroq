import { test, expect } from "@playwright/test";

const stamp = Date.now();
const company = `Smoke Co ${stamp}`;

test("every office page loads for a new owner", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Smoke Tester");
  await page.getByLabel("Email").fill(`smoke+${stamp}@example.com`);
  await page.getByLabel("Password (min 8 characters)").fill("Sup3rSecret!pass");
  await page.getByLabel("Company name").fill(company);
  await page.getByRole("button", { name: /Create my company/ }).click();
  await page.waitForURL("**/office/**");

  const paths = [
    "/office/dashboard",
    "/office",
    "/office/leads",
    "/office/rates",
    "/office/rules",
    "/office/settings",
    "/office/team",
    "/office/billing",
    "/office/audit",
    "/office/account",
    "/office/search?q=test",
  ];
  for (const p of paths) {
    const res = await page.goto(p);
    expect(res?.status(), p).toBeLessThan(400);
    await expect(page.locator("body"), p).not.toContainText(
      "Application error",
    );
  }

  // platform admin is invisible to ordinary owners
  const admin = await page.goto("/office/admin");
  expect(admin?.status()).toBe(404);

  // the company's public form exists
  const form = await page.goto(`/c/smoke-co-${stamp}`);
  expect(form?.status()).toBe(200);
});
