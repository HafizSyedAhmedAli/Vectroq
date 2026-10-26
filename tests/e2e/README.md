# E2E tests (Playwright)

Specs: `public-pages.spec.ts` (no DB needed except the 404 check), `auth.spec.ts` (needs DB),
`lead-intake.spec.ts` (needs a company; set `E2E_ORG_SLUG`).

## Run
```bash
pnpm install
pnpm exec playwright install chromium
cp apps/web/.env.example apps/web/.env   # set DATABASE_URL to a throwaway Postgres
pnpm --filter @vectroq/db exec prisma migrate deploy
pnpm --filter @vectroq/web dev           # terminal 1 (http://localhost:3000)
E2E_ORG_SLUG=<your-slug> pnpm test:e2e   # terminal 2
```
Use a test database: `auth.spec.ts` creates a new account on every run.
