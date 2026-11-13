# E2E tests (Playwright)

Browser tests for the whole app. They need a running app **and a real PostgreSQL
database**. Use a throwaway database: the specs create accounts, companies, leads
and projects, and nothing is cleaned up afterwards.

## Specs

| File | Needs |
|---|---|
| `public-pages.spec.ts` | the app (the 404 check also needs the DB) |
| `security.spec.ts` | the app + DB |
| `auth.spec.ts` | the app + DB (signs up a new account every run) |
| `demo-flow.spec.ts` | the app + DB (starts demo companies) |
| `office-smoke.spec.ts` | the app + DB (signs up a new account every run) |
| `full-flow.spec.ts` | the app + DB (signup, public request form, lead to project) |
| `lead-intake.spec.ts` | the app + DB + `E2E_ORG_SLUG`; **skipped** when it is not set |

## Prerequisites

- Node.js 20 or newer, and pnpm 10.25 (see `packageManager` in `package.json`)
- Docker (only for the ready-made test database below; any PostgreSQL works)
- `pnpm install` run at the repository root

## 1. Database

The repo ships a throwaway PostgreSQL 17 in `docker-compose.test.yml`. Its data
lives in tmpfs, so **stopping it wipes everything**, which is the easiest way to get
a clean database.

```bash
docker compose -f docker-compose.test.yml up -d --wait
```

That gives you `postgresql://postgres:test@localhost:54330/vectroq_test`. The
Prisma schema needs both `DATABASE_URL` and `DIRECT_URL`. Create `apps/web/.env`
(copy `apps/web/.env.example`) and set:

```
DATABASE_URL=postgresql://postgres:test@localhost:54330/vectroq_test
DIRECT_URL=postgresql://postgres:test@localhost:54330/vectroq_test
```

Then apply the migrations (the variables must be set in your shell for this command;
Git Bash / WSL shown, PowerShell below):

```bash
export DATABASE_URL=postgresql://postgres:test@localhost:54330/vectroq_test
export DIRECT_URL=$DATABASE_URL
pnpm --filter @vectroq/db exec prisma migrate deploy
```

```powershell
$env:DATABASE_URL = "postgresql://postgres:test@localhost:54330/vectroq_test"
$env:DIRECT_URL = $env:DATABASE_URL
pnpm --filter "@vectroq/db" exec prisma migrate deploy
```

To start again from a **clean environment**: `docker compose -f docker-compose.test.yml down`,
then repeat the steps above.

## 2. Browser

Playwright uses its own managed Chromium by default:

```bash
pnpm exec playwright install chromium
```

To use a browser you already have instead (for example Chrome on Windows), set
`PW_CHROME_PATH` to its executable:

```powershell
$env:PW_CHROME_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

```bash
export PW_CHROME_PATH=/usr/bin/google-chrome
```

## 3. Run

The config starts the app for you (and reuses one already running on port 3000
when not in CI).

| Command | What it does |
|---|---|
| `pnpm test:e2e` | Run everything, headless |
| `pnpm test:e2e:ui` | Open Playwright UI mode |
| `pnpm test:e2e:headed` | Run with a visible browser (slowed down) |
| `pnpm test:e2e:report` | Open the last HTML report |
| `pnpm exec playwright test tests/e2e/auth.spec.ts` | One spec |
| `E2E_ORG_SLUG=<slug> pnpm test:e2e` | Also run `lead-intake.spec.ts` (PowerShell: `$env:E2E_ORG_SLUG="<slug>"`) |

On failure, traces, screenshots and videos are kept in `test-results/`, and the
HTML report is in `playwright-report/` (both are git-ignored). Open a trace with
`pnpm exec playwright show-trace test-results/<test>/trace.zip`.

## Local development mode vs CI production mode

| | Local (default) | CI, or `E2E_PROD=1` |
|---|---|---|
| App command | `next dev` | `next start` |
| Build needed first | no | **yes**: `pnpm --filter @vectroq/web build` |
| `NODE_ENV` | development | production |
| Server already on :3000 | reused | never reused (CI) |
| Retries | 0 | 2 |

Production mode is what ships, and it behaves differently in ways the tests can
see:

- Session cookies are `secure`.
- Turnstile **fails closed** when `TURNSTILE_SECRET_KEY` is not set, so the public
  request form step in `full-flow.spec.ts` is rejected unless Turnstile keys are
  configured. Development mode skips the check.

The build is never run by the test command, so it is not repeated on every run.
To try production mode locally:

```bash
pnpm --filter @vectroq/web build
E2E_PROD=1 pnpm test:e2e          # PowerShell: $env:E2E_PROD="1"; pnpm test:e2e
```

## Things that can make a re-run fail

- **Rate limits.** All requests from your machine share one IP bucket. Signup is
  limited to 5 per hour (a full run does 3) and demo start to 10 per hour (a run
  does 3). A second run within the hour can get HTTP 429. Start from a clean
  database (see Database above), or clear the counters:
  `docker compose -f docker-compose.test.yml exec pgtest psql -U postgres -d vectroq_test -c 'TRUNCATE "RateLimit"'`
- **No rates are seeded.** The existing specs do not price a BOQ, so they do not
  need any. Pricing tests will need a rate set (planned).
- **Free plan.** New companies are on the Free plan (3 projects a month).
