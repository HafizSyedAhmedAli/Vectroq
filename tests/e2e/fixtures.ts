// Drop-in replacement for `@playwright/test`: same `test` and `expect`, but every
// test gets its OWN client IP. The app's rate limits are keyed by IP (taken from
// X-Forwarded-For), so tests can no longer exhaust each other's budget, and a
// later run cannot inherit a previous run's counters. Production limits are
// untouched; the header is simply sent by the test browser.
import { test as base, expect } from "@playwright/test";
import { createHash } from "node:crypto";

const RUN = createHash("sha1")
  .update(`${process.pid}-${Date.now()}-${Math.random()}`)
  .digest("hex");

/** A unique address in the IPv6 documentation range (2001:db8::/32). */
export function testIp(testId: string, retry: number): string {
  const h = createHash("sha1").update(`${RUN}:${testId}:${retry}`).digest("hex");
  return `2001:db8:${h.slice(0, 4)}:${h.slice(4, 8)}:${h.slice(8, 12)}:${h.slice(12, 16)}::1`;
}

export const test = base.extend<{ clientIp: string }>({
  clientIp: async ({}, use, testInfo) => {
    await use(testIp(testInfo.testId, testInfo.retry));
  },
  // Browser traffic: add the header to same-origin requests only, so third-party
  // requests (the Turnstile widget) are not given a custom header.
  context: async ({ context, baseURL, clientIp }, use) => {
    if (baseURL) {
      const origin = new URL(baseURL).origin;
      await context.route(`${origin}/**`, (route) =>
        route.continue({
          headers: { ...route.request().headers(), "x-forwarded-for": clientIp },
        }),
      );
    }
    await use(context);
  },
  // API calls made with the `request` fixture.
  request: async ({ playwright, baseURL, clientIp }, use) => {
    const ctx = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { "x-forwarded-for": clientIp },
    });
    await use(ctx);
    await ctx.dispose();
  },
});

export { expect };
