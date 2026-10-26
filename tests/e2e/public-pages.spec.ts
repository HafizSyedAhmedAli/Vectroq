import { test, expect } from '@playwright/test';

test.describe('public pages', () => {
  test('landing page renders', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('demo page renders', async ({ page }) => {
    const res = await page.goto('/demo');
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator('body')).toBeVisible();
  });

  test('login page renders its form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Forgot your password?' })).toBeVisible();
  });

  test('signup page renders its form', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByLabel('Your name')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Company name')).toBeVisible();
    await expect(page.getByRole('button', { name: /Create my company/ })).toBeVisible();
  });

  test('theme toggle switches dark mode on and off', async ({ page }) => {
    await page.goto('/login');
    const html = page.locator('html');
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(html).toHaveClass(/dark/);
    await page.getByRole('button', { name: 'Switch to light mode' }).click();
    await expect(html).not.toHaveClass(/dark/);
  });

  test('login shows validation messages for empty and invalid input', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByText('Enter your email address.')).toBeVisible();

    await page.getByLabel('Email').fill('not-an-email');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByText("That doesn't look like a valid email.")).toBeVisible();

    await page.getByLabel('Email').fill('a@b.co');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByText('Enter your password.')).toBeVisible();
  });

  test('show/hide password toggle works', async ({ page }) => {
    await page.goto('/login');
    const pw = page.getByLabel('Password', { exact: true });
    await expect(pw).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(pw).toHaveAttribute('type', 'text');
  });

  test('signup derives the form address from the company name', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('Company name').fill('Acme Builders');
    await expect(page.getByLabel('Your public form address')).toHaveValue('acme-builders');
  });

  test('unknown company slug returns 404', async ({ page }) => {
    const res = await page.goto('/c/this-slug-does-not-exist-e2e');
    expect(res?.status()).toBe(404);
  });
});
