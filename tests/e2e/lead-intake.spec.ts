import { test, expect } from '@playwright/test';

// Requires an existing company; set E2E_ORG_SLUG to its public form slug
// (create one by signing up, the slug is shown on the signup form).
const slug = process.env.E2E_ORG_SLUG;

test.describe('public lead intake /c/[slug]', () => {
  test.skip(!slug, 'Set E2E_ORG_SLUG to run intake tests');

  test('intake page renders the first step', async ({ page }) => {
    await page.goto(`/c/${slug}`);
    await expect(page.getByLabel('Progress')).toBeVisible();
    await expect(page.getByText('Full Name')).toBeVisible();
    await expect(page.getByPlaceholder('Enter your full name')).toBeVisible();
  });

  test('continuing with empty fields shows required errors', async ({ page }) => {
    await page.goto(`/c/${slug}`);
    await page.getByRole('button', { name: /Continue|Next/i }).first().click();
    await expect(page.getByText('Name is required.')).toBeVisible();
    await expect(page.getByText('Contact info is required.')).toBeVisible();
  });

  test('a filled name clears its error', async ({ page }) => {
    await page.goto(`/c/${slug}`);
    await page.getByRole('button', { name: /Continue|Next/i }).first().click();
    await page.getByPlaceholder('Enter your full name').fill('Test Client');
    await page.getByPlaceholder(/03XX/).fill('0300-1234567');
    await page.getByRole('button', { name: /Continue|Next/i }).first().click();
    await expect(page.getByText('Name is required.')).toHaveCount(0);
  });
});
