import { test, expect } from './fixtures';

import { E2E_OWNER } from './support/env';

// Runs against the owner company the `setup` project creates (E2E_OWNER.slug), so
// it no longer needs any manual set-up and is never skipped. To point it at a
// different company, set E2E_ORG_SLUG; an explicitly empty value is an error
// rather than a silent skip.
const slug = process.env.E2E_ORG_SLUG ?? E2E_OWNER.slug;

test.describe('public lead intake /c/[slug]', () => {
  test.beforeAll(() => {
    if (!slug) throw new Error('E2E_ORG_SLUG is set but empty. Unset it to use the default company.');
  });

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
