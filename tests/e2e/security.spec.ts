import { test, expect } from "@playwright/test";

test.describe("signed-out access", () => {
  test("office pages redirect to login and remember where you were going", async ({
    page,
  }) => {
    await page.goto("/office/rates");
    await expect(page).toHaveURL(/\/login\?next=%2Foffice%2Frates/);
  });

  test("APIs answer 401 JSON", async ({ request }) => {
    for (const path of [
      "/api/projects",
      "/api/org/rules",
      "/api/team/invites",
      "/api/leads/x/plan",
    ]) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(401);
      expect(await res.json()).toEqual({ error: "Sign in required." });
    }
  });

  test("an unknown client share link is not found", async ({ page }) => {
    const res = await page.goto("/client/not-a-real-token");
    expect(res?.status()).toBe(404);
    await expect(
      page.getByText("This link is no longer available"),
    ).toBeVisible();
  });

  test("an unknown share PDF is a 404 JSON", async ({ request }) => {
    const res = await request.get("/api/share/not-a-real-token/boq-pdf");
    expect(res.status()).toBe(404);
    expect((await res.json()).error).toMatch(/expired/i);
  });

  test("pages send security headers and only /embed may be framed", async ({
    request,
  }) => {
    const login = await request.get("/login");
    expect(login.headers()["x-content-type-options"]).toBe("nosniff");
    expect(login.headers()["content-security-policy"]).toContain(
      "frame-ancestors 'self'",
    );
    const embed = await request.get("/embed/some-company");
    expect(embed.headers()["content-security-policy"]).toContain(
      "frame-ancestors *",
    );
  });

  test("forgot-password is rate limited per IP", async ({ request }) => {
    const headers = {
      "x-forwarded-for": `10.${Date.now() % 250}.${Math.floor(Math.random() * 250)}.7`,
    };
    for (let i = 0; i < 5; i++) {
      const ok = await request.post("/api/auth/forgot", {
        headers,
        data: { email: "nobody@example.com" },
      });
      expect(ok.status()).toBe(200);
    }
    const blocked = await request.post("/api/auth/forgot", {
      headers,
      data: { email: "nobody@example.com" },
    });
    expect(blocked.status()).toBe(429);
    expect(blocked.headers()["retry-after"]).toBeTruthy();
  });
});
