// Single source of truth for how the E2E harness is configured.
// Loaded by playwright.config.ts, global-setup.ts and the specs' helpers.
//
// The harness NEVER reads DATABASE_URL from your shell or apps/web/.env. It uses
// E2E_DATABASE_URL (default: the docker-compose.test.yml database) and refuses to
// run unless that is a local database whose name ends in "_test".
import path from "node:path";
import { assertTestDatabaseUrl } from "../../../apps/web/src/lib/e2e-guard";

export const REPO_ROOT = path.resolve(__dirname, "../../..");

export const DEFAULT_E2E_DATABASE_URL =
  "postgresql://postgres:test@localhost:54330/vectroq_test";

export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL || DEFAULT_E2E_DATABASE_URL;

export const E2E_PORT = Number(process.env.E2E_PORT || 3000);
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

/** Local folder that stands in for Vercel Blob (git-ignored). */
export const E2E_DXF_DIR = path.resolve(
  process.env.E2E_DXF_STORAGE_DIR || path.join(REPO_ROOT, ".e2e-data", "dxf"),
);

/** Cloudflare's documented always-passes Turnstile test keys (not secrets). */
export const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
export const TURNSTILE_TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";

export const AUTH_DIR = path.join(REPO_ROOT, "tests", "e2e", ".auth");
export const OWNER_STATE = path.join(AUTH_DIR, "owner.json");

/** The owner the `setup` project creates. The database is reset every run, so
 *  these fixed values are stable and easy to find when debugging. */
export const E2E_OWNER = {
  name: "E2E Owner",
  email: "e2e.owner@example.com",
  password: "Sup3rSecret!pass",
  company: "E2E Owner Co",
  slug: "e2e-owner-co",
} as const;

/** Throws unless E2E_DATABASE_URL is a local *_test database. */
export function assertSafeE2EDatabase(): void {
  assertTestDatabaseUrl(E2E_DATABASE_URL, "E2E_DATABASE_URL");
}

/** Environment for the app server the harness starts. Replaces anything in
 *  apps/web/.env (process env wins over .env), so real services are never hit. */
export function appServerEnv(): Record<string, string> {
  assertSafeE2EDatabase();
  return {
    PORT: String(E2E_PORT),
    APP_URL: E2E_BASE_URL,
    DATABASE_URL: E2E_DATABASE_URL,
    DIRECT_URL: E2E_DATABASE_URL,
    // E2E-only behaviour: explicit, and guarded again inside the app.
    VECTROQ_E2E: "1",
    E2E_DXF_STORAGE: "filesystem",
    E2E_DXF_STORAGE_DIR: E2E_DXF_DIR,
    // Official Cloudflare test keys: the real verification code path runs.
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: TURNSTILE_TEST_SITE_KEY,
    TURNSTILE_SECRET_KEY: TURNSTILE_TEST_SECRET_KEY,
    // Blank every external service so a developer's real keys are never used.
    BLOB_READ_WRITE_TOKEN: "",
    PLANS_READ_WRITE_TOKEN: "",
    RESEND_API_KEY: "",
    SMTP_USER: "",
    SMTP_PASS: "",
    EMAIL_FROM: "",
    STRIPE_SECRET_KEY: "",
    STRIPE_WEBHOOK_SECRET: "",
    STRIPE_PRICE_PRO: "",
    STRIPE_PRICE_BUSINESS: "",
    PLATFORM_ADMIN_EMAILS: "",
    CRON_SECRET: "",
  };
}
