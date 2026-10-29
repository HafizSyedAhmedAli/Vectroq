import { test, expect } from "@playwright/test";

test.describe("demo", () => {
  test("a visitor starts the demo and lands on the dashboard", async ({
    page,
  }) => {
    await page.goto("/demo");
    await page.getByRole("button", { name: /start the demo/i }).click();
    await page.waitForURL("**/office/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Welcome back",
    );
    await expect(page.getByText(/demo company/i)).toBeVisible();
  });

  test("the demo includes a sample project that opens", async ({ page }) => {
    await page.goto("/demo");
    await page.getByRole("button", { name: /start the demo/i }).click();
    await page.waitForURL("**/office/dashboard");
    await page.goto("/office");
    await page
      .getByRole("link", { name: /sample client/i })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: "Bill of Quantities" }),
    ).toBeVisible();
  });

  test("the demo cannot invite people", async ({ page }) => {
    await page.goto("/demo");
    await page.getByRole("button", { name: /start the demo/i }).click();
    await page.waitForURL("**/office/dashboard");
    const res = await page.request.post("/api/team/invites", {
      data: { email: "someone@example.com", role: "VIEWER" },
    });
    expect(res.status()).toBe(403);
  });
});
