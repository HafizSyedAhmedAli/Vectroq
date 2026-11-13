import { test, expect } from '@playwright/test';

// Needs a running app + database (see README.md).
const stamp = Date.now();
const user = {
  name: 'E2E Tester',
  email: `e2e+${stamp}@example.com`,
  password: 'Sup3rSecret!pass',
  company: `E2E Co ${stamp}`,
};

test.describe.configure({ mode: 'serial' });

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

test('signup creates a company and lands in the office', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel('Your name').fill(user.name);
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password (min 8 characters)').fill(user.password);
  await page.getByLabel('Company name').fill(user.company);
  await page.getByRole('button', { name: /Create my company/ }).click();
  await page.waitForURL('**/office/**');
  await expect(page).toHaveURL(/\/office\//);
});

test('logout returns to a logged-out state', async ({ page }) => {
  await login(page, user.email, user.password);
  await page.waitForURL('**/office/**');
  await page
    .locator('[data-user-menu]')
    .getByRole('button', { name: new RegExp(user.name) })
    .click();
  const loggedOut = page.waitForResponse(
    (r) => r.url().endsWith('/api/auth/logout') && r.request().method() === 'POST',
  );
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  expect((await loggedOut).ok()).toBe(true);
  await page.goto('/office');
  await expect(page).toHaveURL(/\/login/);
});

test('login with the new account works', async ({ page }) => {
  await login(page, user.email, user.password);
  await page.waitForURL('**/office/**');
  await expect(page).toHaveURL(/\/office/);
});

test('wrong password shows an error and stays on /login', async ({ page }) => {
  await login(page, user.email, 'definitely-wrong-password');
  // Next.js also renders an empty role="alert" route announcer, so a bare
  // getByRole('alert') matches two elements. Select the one with the message.
  await expect(
    page.getByRole('alert').filter({ hasText: 'Wrong email or password.' }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test('protected pages redirect anonymous visitors to login', async ({ page }) => {
  await page.goto('/office');
  await expect(page).toHaveURL(/\/login/);
});
