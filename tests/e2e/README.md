# E2E tests (Playwright)

Browser tests for the whole app. They need **Docker** (for a throwaway PostgreSQL)
and an app server, which the config starts for you.

The harness is built to be safe and repeatable:

- It uses its **own** database (`E2E_DATABASE_URL`) and refuses to run unless that
  is a local database whose name ends in `_test`. It never reads `DATABASE_URL`
  from your shell or `apps/web/.env`.
- Every run migrates, **empties and re-seeds** that database first, so no run
  depends on leftovers.
- The app server is started with its own environment (test DB, test DXF storage,
  Turnstile test keys, all external service keys blank). Your real keys in
  `apps/web/.env` are never used and never changed.

## Prerequisites

- Node.js 20+, pnpm 10.25, `pnpm install` at the repo root
- Docker (Docker Desktop on Windows)
- A browser: `pnpm exec playwright install chromium`, or set `PW_CHROME_PATH`
- Internet access (Cloudflare Turnstile test widget, see below)
- **Stop any dev server on port 3000.** The harness never reuses a running server
  (its database would be unknown). Use `E2E_PORT=3100` to run on another port,
  but Next.js allows only one `next dev` per checkout.

## Quick start

```bash
pnpm e2e:db:up      # starts postgres on localhost:54330 (db vectroq_test)
pnpm test:e2e       # migrate + reset + seed + run everything
```

PowerShell (Chrome instead of the managed Chromium):

```powershell
$env:PW_CHROME_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
pnpm e2e:db:up
pnpm test:e2e
```

Git Bash: `export PW_CHROME_PATH=/usr/bin/google-chrome` (optional), then the same two commands.

## Running the suite twice on clean environments

```bash
pnpm e2e:db:down && pnpm e2e:db:up && pnpm test:e2e   # run 1, brand-new database
pnpm e2e:db:down && pnpm e2e:db:up && pnpm test:e2e   # run 2, another brand-new database
```

PowerShell: use `;` instead of `&&` (`pnpm e2e:db:down; pnpm e2e:db:up; pnpm test:e2e`).
Re-running `pnpm test:e2e` without recreating the container also starts clean,
because the run itself resets the database.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `E2E_DATABASE_URL` | `postgresql://postgres:test@localhost:54330/vectroq_test` | Test database. Must be local and end in `_test`, or nothing runs. |
| `E2E_PORT` | `3000` | App port |
| `E2E_DXF_STORAGE_DIR` | `.e2e-data/dxf` | Folder standing in for Vercel Blob (git-ignored) |
| `E2E_ORG_SLUG` | `e2e-owner-co` | Company used by `lead-intake.spec.ts` |
| `E2E_PROD` | unset | `1` = test `next start` (needs a build, see below) |
| `PW_CHROME_PATH` | unset | Use an installed browser |

Set by the harness for the app server (you do not set these): `VECTROQ_E2E=1`,
`E2E_DXF_STORAGE=filesystem`, `E2E_DXF_STORAGE_DIR`, `DATABASE_URL`, `DIRECT_URL`,
`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, and blank
`BLOB_READ_WRITE_TOKEN`, `PLANS_READ_WRITE_TOKEN`, `RESEND_API_KEY`, `SMTP_*`,
`STRIPE_*`, `PLATFORM_ADMIN_EMAILS`, `CRON_SECRET`.

## Database lifecycle

`global-setup.ts` runs `prisma migrate deploy`, connects, asks the server for
`current_database()` (must end in `_test`), truncates every table except Prisma's
migration history, then seeds. If any check fails, nothing is deleted.
Data from a failed run stays in the database until the next run starts.

## Pricing seed

`support/seed.ts` upserts three **shared** approved rate sets (Karachi, categories
A/B/C), ids `e2e-rateset-karachi-a|b|c`, `approvedBy = "e2e-seed"`. All values are
invented, not market prices. They make new projects price (the demo sample is
Karachi / B). Nothing in the app's production code carries these numbers.

## DXF storage (E2E-only)

`apps/web/src/lib/cad-dxf-store.ts` wraps the three blob operations (save, read,
delete). Production uses Vercel Blob. The folder backend is used **only** when
`VECTROQ_E2E=1`, `E2E_DXF_STORAGE=filesystem` and `E2E_DXF_STORAGE_DIR` are all set
**and** `DATABASE_URL`/`DIRECT_URL` are local `*_test` databases **and** no
`VERCEL*` variable is present. If `E2E_DXF_STORAGE` is set but those conditions are
not met, uploads throw; they never fall back to Blob or to disk silently. The real
upload route, validation and parsing run unchanged. Not covered: org logos and
lead plan files still use Blob (their tokens are blank under E2E).

## Rate-limit isolation

Limits are keyed by client IP (`X-Forwarded-For`). `fixtures.ts` gives every test
its own address in `2001:db8::/32`, so tests cannot exhaust each other and a new
run cannot inherit old counters. No production code or limit changed, and there is
no bypass endpoint. Import `test`/`expect` from `./fixtures`, not `@playwright/test`.

## Authentication

The `setup` project (`auth.setup.ts`) signs up `e2e.owner@example.com` / company
`E2E Owner Co` (slug `e2e-owner-co`) through the real UI and saves
`tests/e2e/.auth/owner.json` (git-ignored). Use it with
`test.use({ storageState: OWNER_STATE })` (see `authenticated.spec.ts`). Specs that
test signup/login still create their own accounts.

## Turnstile

The app server gets Cloudflare's official always-pass **test** keys (public values,
not secrets), so the real verification code runs. This needs internet access from
the browser and the server to `challenges.cloudflare.com`. Without it
`full-flow.spec.ts` (public form) fails; it is not skipped. Production mode
(`E2E_PROD=1`): the site key is baked in at build time, so build with
`NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA pnpm --filter @vectroq/web build`.

## Specs

| File | Notes |
|---|---|
| `auth.setup.ts` | `setup` project: creates owner + session |
| `public-pages`, `security` | app (+ DB for 404 and rate-limit checks) |
| `auth`, `office-smoke`, `full-flow` | sign up their own accounts |
| `demo-flow` | starts demo companies (priced from the seed) |
| `lead-intake` | uses the seeded owner company; **no longer skipped** |
| `authenticated` | checks the saved session works |

## Other commands

`pnpm test:e2e:ui`, `pnpm test:e2e:headed`, `pnpm test:e2e:report`,
`pnpm exec playwright test tests/e2e/auth.spec.ts` (setup still runs first).
Failure traces/screenshots/videos go to `test-results/`, report to `playwright-report/`.

## Dev vs production server

`next dev` by default (compiles routes on first visit; 120 s per-test budget).
`E2E_PROD=1` or `CI` uses `next start` after `pnpm --filter @vectroq/web build`
(60 s budget, secure cookies, Turnstile fails closed without a secret).

## Known limitations

- Needs Docker and internet (Turnstile). Email, Stripe and Blob-backed logo/plan
  uploads are blanked, not simulated; features needing them are untested.
- Rate-limit isolation relies on the app trusting `X-Forwarded-For` (existing behaviour).
- Specs run serially (1 worker) against one database.
- CAD upload tests are not part of this phase; the storage seam is ready for them.
