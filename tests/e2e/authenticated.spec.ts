// Proves the shared `storageState` login works, so later specs can rely on it.
import { test, expect } from "./fixtures";
import { OWNER_STATE } from "./support/env";

test.use({ storageState: OWNER_STATE });

test("the saved owner session opens the office without logging in", async ({ page }) => {
  await page.goto("/office/leads");
  await expect(page).toHaveURL(/\/office\/leads/);
  await expect(page).not.toHaveURL(/\/login/);
});
