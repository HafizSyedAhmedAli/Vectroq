// Runs once per Playwright run (the `setup` project). Signs up the deterministic
// owner through the real UI and saves the session for specs that just need to be
// signed in:  test.use({ storageState: OWNER_STATE })
import { test as setup, expect } from "./fixtures";
import { E2E_OWNER as o, OWNER_STATE } from "./support/env";

setup("create the E2E owner and save its session", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill(o.name);
  await page.getByLabel("Email").fill(o.email);
  await page.getByLabel("Password (min 8 characters)").fill(o.password);
  await page.getByLabel("Company name").fill(o.company);
  await expect(page.getByLabel("Your public form address")).toHaveValue(o.slug);
  await page.getByRole("button", { name: /Create my company/ }).click();
  await page.waitForURL("**/office/**");
  await page.context().storageState({ path: OWNER_STATE });
});
