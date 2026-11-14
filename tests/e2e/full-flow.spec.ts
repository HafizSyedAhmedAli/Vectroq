import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

const stamp = Date.now();
const company = `Flow Co ${stamp}`;
const slug = `flow-co-${stamp}`;
const email = `flow+${stamp}@example.com`;
const password = "Sup3rSecret!pass";
const client = `Client ${stamp}`;

test.describe.configure({ mode: "serial" });

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/office/**");
}

test("owner signs up", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Flow Owner");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password (min 8 characters)").fill(password);
  await page.getByLabel("Company name").fill(company);
  await expect(page.getByLabel("Your public form address")).toHaveValue(slug);
  await page.getByRole("button", { name: /Create my company/ }).click();
  await page.waitForURL("**/office/**");
});

test("a visitor submits the public request form", async ({ page }) => {
  // The server rejects a lead submitted less than 4 s after the form opened
  // (MIN_FILL_MS in bot-check.ts). Control the page clock instead of sleeping.
  await page.clock.install();
  await page.goto(`/c/${slug}`);

  await page.getByLabel(/full name/i).fill(client);
  await page.getByLabel(/contact/i).fill("0300-1234567");
  await page.getByLabel(/city/i).selectOption("Karachi");
  await page.getByRole("radio").first().click();
  await page.getByRole("button", { name: /continue/i }).click();

  await page.getByRole("radio", { name: "Villa" }).click();
  await page.getByLabel(/number of floors/i).selectOption({ index: 2 });
  await page.getByLabel(/bedrooms/i).selectOption({ index: 3 });
  await page.getByLabel(/budget range/i).selectOption({ index: 2 });
  await page.getByLabel(/plot size/i).fill("240");
  await page.getByLabel(/covered area/i).fill("1800");
  await page.getByLabel(/timeline/i).selectOption({ index: 2 });
  await page.getByRole("radio", { name: /category b/i }).click();
  await page.getByRole("button", { name: /continue/i }).click();

  await page.getByRole("checkbox", { name: /agree to be contacted/i }).check();
  // By now the form has hydrated and recorded when it opened. Jump the clock
  // past the 4 s minimum so the submission is not treated as a bot.
  await page.clock.fastForward(5000);
  const created = page.waitForResponse(
    (r) => r.url().endsWith("/api/leads") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: /submit project request/i }).click();
  // Assert the server's answer first: a failure then shows the status and body
  // (bot check, validation, rate limit) instead of a bare "Thank You! not found".
  const res = await created;
  expect(res.status(), await res.text()).toBe(201);
  await expect(page.getByText("Thank You!")).toBeVisible();
});

test("the owner turns the lead into a project", async ({ page }) => {
  await login(page);
  await page.goto("/office/leads");
  await expect(page.getByText(client)).toBeVisible();
  await page.getByRole("button", { name: /create project/i }).click();
  await page.waitForURL(/\/office\/c[a-z0-9]{20,}$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(client);
});
