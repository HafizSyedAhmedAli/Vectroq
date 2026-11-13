# 9. Playwright End-to-End Testing Strategy

**Status:** investigation and planning only. Nothing was installed, run, configured or modified.
**Source:** branch `phase-1-dxf-units`, commit `fb49d3d`, read statically. I did **not** run the existing E2E suite, so "does it pass today" is unknown. Claims marked *(unverified)* need a real run to confirm.

---

## 9.1 Existing Playwright infrastructure

### What exists

| Area | Finding | Where |
|---|---|---|
| Installed | Declared, not installed in my clone. Declared **twice**: root `^1.48.0` and `apps/web` `^1.56.1`. Lockfile resolves both to **1.63.0**. | `package.json`, `apps/web/package.json`, `pnpm-lock.yaml:871` |
| Config | One root config. `testDir ./tests/e2e`, `fullyParallel: false`, `workers: 1`, `retries: 2` only when `CI` is set. | `playwright.config.ts` |
| Browser | **Hard-coded Windows Chrome path** `C:\Program Files\Google\Chrome\Application\chrome.exe`. Fails on Linux/macOS/CI. Contradicts the README's `playwright install chromium`. No `projects` list. | `playwright.config.ts` |
| App start | `webServer` runs `pnpm -F @vectroq/web prod` = `pnpm run build && next start` (prisma generate + full Next build every run). `reuseExistingServer: !CI`. No env passed to the server. | `playwright.config.ts`, `apps/web/package.json` |
| Failure capture | `trace: "on-first-retry"` only. With `retries: 0` locally, **nothing is ever captured**. No screenshot, no video, no reporter configured. | `playwright.config.ts` |
| Scripts | `test:e2e` = `playwright test`. `test:e2e:ui` actually runs `--headed` (not `--ui`). `pnpm test` runs Vitest only; E2E is not part of it. | root `package.json` |
| Specs | 7 files, 391 lines: `public-pages`, `auth`, `security`, `lead-intake`, `demo-flow`, `full-flow`, `office-smoke`. | `tests/e2e/` |
| **CAD coverage** | **None.** A grep for `cad`, `dxf`, `upload`, `unit` in `tests/e2e` finds only a share-PDF 404 check. | `tests/e2e/security.spec.ts:33` |
| README | Lists 3 of the 7 specs. Tells you to run `pnpm dev` in a terminal, but CI mode builds production. | `tests/e2e/README.md` |

### Authentication in tests
No `storageState`, no setup project. Every spec signs up through the UI (`auth`, `full-flow`, `office-smoke`) and `full-flow` logs in through the UI. `demo-flow` uses the demo start button. Users are made unique with `Date.now()`.

### Test database and data
- No E2E database config. The README says: copy `apps/web/.env.example`, point `DATABASE_URL` at a throwaway Postgres, `prisma migrate deploy`, start the app yourself.
- **Nothing is cleaned up.** Each run leaves orgs, users, leads and projects behind.
- `docker-compose.test.yml` provides `postgres:17-alpine` on port 54330 with tmpfs, DB `vectroq_test`. Its comment says "Not used by the app", it is for the Vitest PostgreSQL tests only. It is reusable for E2E but is not wired in.
- **No rate data is seeded anywhere.** A fresh org cannot price a BOQ (`finalize` returns 502 `RateUnavailableError`).

### Can it run reliably in CI today? No, for these concrete reasons

1. **No CI exists in this branch.** No `.github/`, GitLab, CircleCI or Azure files. `apps/web/vercel.json` only defines a cron.
2. **Windows Chrome path** breaks any Linux runner.
3. **Production mode changes behaviour.** `next start` sets `NODE_ENV=production`:
   - `verifyTurnstile` fails closed when `TURNSTILE_SECRET_KEY` is unset (`apps/web/src/lib/bot-check.ts`), and `POST /api/leads` calls it (`leads/route.ts:68`). So the public-form step in `full-flow.spec.ts` *likely* fails unless Turnstile keys are provided *(unverified)*.
   - Session cookie is `secure: true` in production (`lib/auth/session.ts`). Chromium accepts this on `localhost`; other browsers *(unverified)*.
4. **Rate limits are per IP, and every local request is one IP.** `clientIp()` returns `x-forwarded-for`, else `x-real-ip`, else `"unknown"`. So all Playwright traffic shares one bucket:
   - `signup:ip` is 5 per hour. One run does 3 UI signups, so a **second run within the hour likely hits 429** on its third signup.
   - `demo:ip` is 10 per hour; `demo-flow` does 3 starts per run.
   - `login:ip` is 30 per 15 min; `login:<ip>:<email>` is 8 per 15 min.
5. **Blob storage.** DXF upload and unit change use `@vercel/blob` (`lib/cad-dxf-store.ts`, `PLANS_READ_WRITE_TOKEN`). The calls run **server-side**, so Playwright's `page.route` cannot intercept them. See 9.5 for options. This is the biggest blocker for CAD E2E.
6. **Free plan cap.** Fresh orgs are on `FREE`, which allows 3 projects per month (`lib/billing/plans.ts`). `POST /api/projects` returns 402 after that.

### Existing reliability smells
- `page.waitForTimeout(4500)` in `full-flow.spec.ts` (mirrors `MIN_FILL_MS = 4000` in `bot-check.ts`).
- `.catch(() => {})` swallowing a failed click in `auth.spec.ts` (logout test).
- `serial` suites where later tests depend on earlier ones (`auth`, `full-flow`): one failure cascades.
- `lead-intake.spec.ts` silently skips unless `E2E_ORG_SLUG` is set.
- Only **3 `data-testid`s** exist in app code (`unit-legacy`, `unit-confirmed`, `unit-picker` in `UnitConfirmation.tsx`). Selectors elsewhere are role/label based, which is good, but the CAD panel has several `role="status"` elements and no testids for stat tiles, notice, BOQ table or status badge.

### What lower layers already cover (do not duplicate)

| Layer | File(s) | Covers |
|---|---|---|
| Component (jsdom, fetch mocked) | `CardReviewPanel.test.tsx` (377 lines) | upload display, correction, BOQ display, unit picker, discard prompt, revision sent/returned, conflict message |
| Route (Prisma mocked) | `cad-upload`, `cad-unit`, `geometry`, `finalize` `route.test.ts` | validation, 4xx/5xx, blob cleanup, gate, status writes |
| Concurrency model | `cad-concurrency.test.ts` | in-memory model of the revision protocol |
| **Real PostgreSQL** | `cad-concurrency.pg.test.ts` (skipped unless `TEST_DATABASE_URL`) | READ COMMITTED re-check, racing writes, rollback atomicity, API-level upload to confirm to save to finalize |
| Parser | `units.test.ts`, `parse-dxf*.test.ts`, `eval/`, `audit/`, `baselines/legacy` | unit detection, geometry, legacy baselines |
| BOQ | `packages/boq-engine/src/*.test.ts` | quantity formulas |

Note: the PG tests are **silently skipped** in any CI that does not set `TEST_DATABASE_URL`, so Phase 1B concurrency protection is only real if CI sets it.

---

## 9.2 Missing E2E coverage

| # | Priority workflow | Browser E2E today | Lower-level coverage | Gap |
|---|---|---|---|---|
| 1 | DXF upload and parsing | none | route + component (mocked) | real upload, real parse, real persistence, reload |
| 2 | Unit detection and confirmation | none | parser + component + route (mocked) | the full picker flow against a real server and DB |
| 3 | Finalization restrictions | none | route (mocked), component | cookie-authenticated 409 against real stack |
| 4 | Geometry editing | none | component + route (mocked) | edit, save, reload persistence |
| 5 | BOQ invalidation after edits | none | route unit test of the transaction | the user-visible chain: edit, BOQ gone, badge changes |
| 6 | Project status transitions | none | scattered | one journey: NEW, CAD uploaded, Finalized, back |
| 7 | BOQ generation and display | only `demo-flow` opens the BOQ heading | engine tests | real pricing, table consistency, persistence |
| 8 | Errors and stale revisions | none | pg + component (mocked fetch) | two real tabs, real 409 shown in the UI |

---

## 9.3 Critical workflows to automate

Selectors below are the ones that exist today in the code (aria-labels, roles, visible text, 3 testids).

### W1. DXF upload and parsing
- **Actions:** open `/office/<projectId>`; `setInputFiles` on the file input (`getByLabel("Upload AutoCAD file (.dxf)")`, `#cad-file`, it is `sr-only`).
- **UI:** stat tiles *Rooms / Wall length / Covered area* appear, file name replaces "No file chosen", button text becomes "Replace drawing", stepper "Upload drawing" done, badge "CAD uploaded", the unit section appears.
- **Backend/DB:** `CadFile` row with `geometry`, `unit`, `dxfBlobKey`, `revision`; `Project.status = CAD_UPLOADED`; `boq` null; audit `CAD_UPLOADED`.
- **Assertions:** wait on the `cad-upload` response (status 200, read `revision` from JSON); tiles non-zero; after `page.reload()` file name, tiles and badge persist. Negative: a `.dwg` name shows an alert containing "`.dwg` files aren't supported yet"; a text file named `.dxf` shows "Could not parse this DXF file"; state unchanged after both.
- **Fixtures:** small generated DXFs (see 9.5). Real `sample-house.dxf` (3,386 lines, declares `$INSUNITS`) for **one** realistic smoke test only.
- **Isolated?** Yes per project, **but needs a blob strategy**.

### W2. Unit detection and confirmation
- **Unitless drawing** (e.g. `unitless-40x30.dxf`, a single 40x30 closed polyline, no header): `[data-testid=unit-picker]` visible; warnings list `aria-label="Unit warnings"`; radios `name="drawing-unit"` each showing "Drawing would be W x H ft"; a "Suggested" pill; "Calculate BOQ" **disabled** with the hint "Confirm the drawing unit to enable "Calculate BOQ"". Choose a unit, click "Confirm unit", notice "Unit confirmed and the drawing re-read...", `[data-testid=unit-confirmed]` shows "Drawing unit: ... (confirmed by you)", Calculate BOQ enabled.
- **Header-declared unit:** `unit-confirmed` appears immediately with "(read from the drawing)", no picker.
- **Override the suggestion:** pick a different unit; assert the *ratio* between the Wall-length tile before and after matches the expected unit-factor ratio (for example feet to metres is x3.2808, within rounding). Ratios avoid hard-coding parser output.
- **Legacy row (unit NULL):** `[data-testid=unit-legacy]`. Only creatable by seeding the DB directly. Low value (component-tested); keep as one optional test.
- **Backend/DB:** `unit.source = "user"`, `confirmed: true`; `revision` +1; `boq` null; status `CAD_UPLOADED`; audit `CAD_UNIT_CONFIRMED`.
- **Isolated?** Yes. Needs the stored original DXF, so the blob strategy applies.

### W3. Finalization restrictions
- **UI:** with an unconfirmed drawing the "Calculate BOQ" button is disabled. Assert `toBeDisabled()` and, with a `page.route("**/finalize")` counter, that **zero** finalize requests were sent.
- **Server enforcement through the real stack:** `page.request.post('/api/projects/<id>/finalize')` (shares the session cookie) returns **409** with `code: "UNIT_CONFIRMATION_REQUIRED"`; after `reload` the badge is still "CAD uploaded" and "No BOQ yet" is shown. This is the one API-level assertion worth keeping in Playwright: it proves the gate holds with real auth and a real DB, which the mocked route test cannot.
- **No rates:** org without an approved rate set, Calculate BOQ, alert "No rates loaded for Karachi (Category B)..." (502), status unchanged.
- **Isolated?** Yes. The no-rates case needs an org *without* rates, so seed rates in a way that can be skipped per org (see 9.5).

### W4. Geometry editing
- **Actions:** edit `Room 1 area` / `Room 1 name` / `Wall 1 length` (aria-labels exist); delete with `Remove wall 1`; "Save corrections".
- **UI:** hint "Unsaved changes..." while dirty; notice "Corrections saved."; values survive reload.
- **Backend/DB:** `geometry` replaced (only walls/rooms/openings), `unit.geometryEditedAt` set, `revision` +1, `boq` null.
- **Variants:** edit then "Calculate BOQ" without saving (the panel auto-saves first); edit then "Change unit" shows `role=alertdialog` "Replace manual corrections?" Cancel changes nothing, Replace restores the parsed values.
- **Isolated?** Yes. Can run on the **bundled sample project** (no blob needed, see 9.5).

### W5. BOQ invalidation after geometry changes
- **Setup:** project with a priced BOQ (Finalized, total visible under "Total estimated cost").
- **Action:** change a wall length, Save corrections.
- **UI:** notice "...The previous BOQ was cleared..."; Bill of Quantities card returns to "No BOQ yet"; badge goes "Finalized" to "CAD uploaded" (server badge refreshed via `router.refresh()`; use auto-retrying `expect`); stepper "Review & price BOQ" no longer done; share-link panel disappears.
- **Backend/DB:** `cadFile.boq` null, `project.status = CAD_UPLOADED`, `revision` +1.
- **Then:** Calculate BOQ again; the new total **differs** from the old (do not assert a number).
- **Also invalidated by:** unit change, re-upload. One parametrised test.
- **Isolated?** Yes.

### W6. Project status transitions
Status is a plain string: `NEW`, `CAD_UPLOADED`, `FINALIZED`. One journey test asserts the badge at each step **and** that the project appears under the right value of the list's "Filter by status":
NEW, upload, CAD uploaded, confirm unit (still CAD uploaded), Calculate BOQ, Finalized, edit geometry, CAD uploaded, Calculate BOQ, Finalized, change unit, CAD uploaded.
- **Isolated?** Yes. Overlaps W5, so keep it as a thin test and let W5 hold the BOQ assertions.

### W7. BOQ generation and display
- **UI:** after "Calculate BOQ", notice "BOQ calculated...", table groups (*Structure, Masonry & Plaster, Finishes, Services & Fixtures, Materials*), rows Item / Quantity / Rate / Amount, Subtotal, Sales tax, **Total estimated cost**, a rate-basis line, a "Print / Save PDF" link to `/office/<id>/boq`.
- **Assertions (consistency, not engine math):** total > 0; the sum of group subtotals equals Subtotal; Subtotal + tax equals Total, each within a rounding tolerance (the table rounds to whole rupees, so allow at most the number of rows); everything persists after reload. Leave exact quantity formulas to `boq-engine` Vitest.
- **Do not assert** the transient "Pricing your BOQ... Ns" status; it is timing dependent.
- **Fixtures:** a seeded approved rate set. `findApproved` accepts `organizationId: null` (shared library) sets, so **one global shared set serves every test org**. It must contain every `CORE_MATERIAL_TYPES` item; `packages/rate-cards/src/test-rate-card.ts` already builds a complete card from `RATE_ITEM_TYPES`.
- **Isolated?** Yes, given the seed.

### W8. Errors and stale-revision conflicts
Deterministic, sequential, **no real race**:
1. Two pages in one browser context (same session) load the same project at revision r.
2. Page B edits and saves (revision r+1).
3. Page A edits a different field and saves; expect `role=alert` containing "This drawing was changed somewhere else", then reload A and confirm B's value won and A's value was **not** written.
4. Same with a stale **unit confirm** (A confirms after B changed the unit): conflict alert, unit state unchanged.
5. Dirty and stale: A edits, clicks Calculate BOQ; the auto-save conflicts; no BOQ is produced.

True races (simultaneous requests, row locks, rollback) stay in `cad-concurrency.pg.test.ts`. A 400 for a missing `expectedRevision` is unreachable from the UI and stays API-level.
- **Isolated?** Yes.

---

## 9.4 Recommended Phase 1 / 1B regression suite (minimal)

About **13 tests in 3 files**, 5 tagged `@smoke` for pull requests.

| File | Test | Covers | Tag |
|---|---|---|---|
| `cad-units.spec.ts` | header-declared unit uploads and prices without a picker | W1, W2, W7 | `@smoke` |
| | unitless drawing blocks BOQ until the unit is confirmed | W2, W3 | `@smoke` |
| | changing the unit re-reads the drawing and clears the BOQ | W2, W5 | |
| | corrections + unit change asks before discarding; Cancel is a no-op | W4, W2 | |
| | server refuses to price an unconfirmed drawing (API via the browser session) | W3 | |
| `cad-geometry-boq.spec.ts` | corrections persist across reload | W4 | |
| | saving corrections invalidates the BOQ and demotes status | W5, W6 | `@smoke` |
| | Calculate with unsaved edits saves first, then prices | W4, W7 | |
| | BOQ table is internally consistent and persists | W7 | |
| | status journey incl. list filter | W6 | |
| `cad-errors.spec.ts` | `.dwg` and corrupt `.dxf` show errors, state unchanged | W1 | |
| | stale tab save and stale unit confirm show conflict, overwrite nothing | W8 | `@smoke` |
| | no approved rates: clear error, project stays "CAD uploaded" | W3, W7 | |

The existing 7 specs stay and get a `@public` tag.

### What stays out of Playwright

| Concern | Owner |
|---|---|
| Unit candidate math, plausibility thresholds, `$INSUNITS` table | `units.test.ts`, parser eval |
| READ COMMITTED behaviour, racing writes, transaction rollback | `cad-concurrency.pg.test.ts` |
| 400/404/422 validation matrix, rate limiting, 502 blob failures, orphan-blob cleanup | route tests |
| Role matrix, audit log content, tenant isolation | route tests |
| BOQ quantity formulas | `boq-engine` tests |
| Component state machine details | `CardReviewPanel.test.tsx` |

---

## 9.5 Phase 2 E2E coverage (geometry normalization)

**Not implemented on this branch.** There is no `normalize-segments.ts` in `packages/cad-parser/src`, and no jitter or misalignment helper exists in `eval/` or `audit/`. The plan is in `DXF_PARSER_IMPROVEMENT_PLAN.md` (Phase 2, initial `snap` ~0.05 ft marked **[Assumption]**) and the relevant invariants are INV-2 (each physical wall once) and INV-5 (one frame, rotation recorded). The tests below should be written **with** the feature.

### Technique: metamorphic comparison instead of golden numbers
Upload a "clean" plan into project A and a perturbed twin into project B, then compare what the UI shows. This needs no hard-coded parser output and survives tolerance tuning. Stat tiles round (walls to whole ft, area to whole sq ft), so compare within +/-1.

### In the browser
| Behaviour | Test | UI observables |
|---|---|---|
| Slightly misaligned endpoints (jitter below `snap`, e.g. 0.5x the tolerance constant imported, not hard-coded) | clean twin vs jittered twin | same *Rooms*, *Wall length*, *Covered area* tiles |
| Over-aggressive snapping (negative control: gap above `snap`) | gap drawing | walls/rooms **not** merged, differs from the clean twin |
| Displaying normalized geometry | wall table | wall row count equals the number of physical walls (INV-2); no duplicate rows (`Wall N length` inputs) |
| Preserving room and wall information | compare twins | same room names and types (`Room N name/type`), same wall heights |
| Editing normalized geometry | edit a wall, save, reload | persists; a unit-change re-parse gives the same tiles again (deterministic) |
| No duplicate wall quantities in the BOQ | drawing with a shared or doubly-drawn wall vs the same plan drawn once | *Wall length* tile and the brick/plaster BOQ rows equal across the twins (within rounding) |
| Rotation (INV-5) | rotated copy of a plan | same tiles |
| Parse report surfaced to the user | only if Phase 2 adds a UI note | add a testid such as `parse-report`; today only unit warnings are rendered |

### Lower level (Vitest in `packages/cad-parser`)
Exact cluster counts and centroid positions; T-junction splitting; collinear overlap merge; tolerance boundary values (0.99x vs 1.01x `snap`); determinism and the grid-key straddle case (N4); rotation angles; per-fixture legacy baselines; the plan's `toMatchGeometry` property tests; performance. Route-level: persisted geometry carries no `meta`. Playwright asserts only user-visible consequences.

### Fixture strategy
A small TypeScript DXF builder under `tests/e2e/support/` (options: walls, rooms, `$INSUNITS`, jitter, duplicate walls, rotation). The repo's generators (`scripts/generate-fixture.py`, `generate-whole-house.py`) are Python and would add a CI dependency. Commit the few generated `.dxf` files plus the builder.

### Blob strategy for upload and unit-change tests (decision needed)
| Option | Verdict |
|---|---|
| A. Real Vercel Blob with a test token | Network, cost, cleanup, flaky. Not recommended. |
| B. Small storage seam in `cad-dxf-store.ts` (in-memory/filesystem when an explicit E2E env flag is set; must refuse to activate in a real production deployment) | **Recommended.** About 20 lines. Requires an app change after approval. |
| C. Point the SDK at a local mock API via an env override | Would avoid touching app code, but I could **not verify** that `@vercel/blob` supports a base-URL override. Check before choosing. |

**Key decoupling:** the bundled **sample project** (`POST /api/onboarding/sample-project`, button `LoadSampleButton`) is created already unit-confirmed (millimetres) with **no blob**. W4, W5, W6, W7 and W8 can run on it with no blob strategy at all. Only W1, W2 and unit-change steps need blob support.

---

## 9.6 Test environment and reliability

### Isolation and data
- **Database:** fresh Postgres per CI run (service container, or reuse `docker-compose.test.yml` with tmpfs). Name must end in `_test` (mirror the guard in `cad-concurrency.pg.test.ts`), e.g. `vectroq_e2e_test`. Run `prisma migrate deploy` once.
- **Global setup (test side only, no app change):** migrate; seed one **shared** approved `RateSet` (`organizationId: null`, all core types) for the cities used; clear the `RateLimit` table.
- **Per worker:** one org + owner. Sign in **once** through the real login UI in a `setup` project and save `storageState` (1 login per worker, well under the 30 per 15 min limit). Create the org on a paid plan or insert projects directly via Prisma to avoid the 3-per-month Free cap.
- **Per test:** its own project created by a helper (direct DB insert of lead + project). Tests never share a project, so they are order-independent and can run in parallel.
- **Cleanup:** wipe the whole DB between runs (tmpfs); for a persistent dev DB, a teardown deletes orgs whose slug starts with `e2e-`.
- **Rate limits:** truncate `RateLimit` in global setup and `beforeEach` for upload tests (`cad-upload` allows 20 per user and 60 per org per hour). This is a test-side DB operation, not an app change.

### Parallel execution
Keep `workers: 1` for the first CI-green milestone, then try 2 with one org per worker. Shared concerns: single `next start` process (fine), rate-limit buckets (cleared), login budget (one login per worker).

### Flaky-test prevention
- **No sleeps.** Replace `waitForTimeout(4500)`: the intake form computes `elapsedMs = Date.now() - openedAt` client-side (`PublicIntake.tsx:42`), so `page.clock.install()` then `page.clock.fastForward(5000)` is deterministic.
- **Sync on responses, not time:** `const r = page.waitForResponse(x => x.url().includes("/cad-upload") && x.request().method()==="POST")` then `setInputFiles`, then assert `(await r).status()`.
- Web-first assertions only (`toBeVisible`, `toHaveText`, `toBeDisabled`, `toHaveURL`); `expect.poll` for DB reads.
- Never assert transient states ("Parsing drawing...", "Pricing your BOQ... Ns") or viewport position (`scrollIntoView` runs after a 150 ms timer).
- Set a fixed context `locale: "en-US"`. Numbers are formatted with `en-PK`/`en-US`; parse with a helper that strips commas and `Rs`.
- 3D viewer (react-three-fiber/WebGL): assert only that a canvas exists; headless WebGL may need software rendering flags *(unverified)*.
- Use `--repeat-each=10` locally on new specs, and `failOnFlakyTests` in CI so retries do not hide flakiness (confirm option support in 1.63).

### Stable selectors
Prefer role/label (already good): buttons "Save corrections", "Calculate BOQ", "Confirm unit", "Change unit"; inputs `Room N area|name|type`, `Wall N length|height`; `alertdialog` "Replace manual corrections?"; `role=alert` for errors. **Proposed small `data-testid` additions (app change, after approval):**
`cad-notice` (the `role=status` notice), `stat-rooms`, `stat-wall-length`, `stat-covered-area`, `project-status-badge`, `boq-total`, `boq-table`, and a `data-revision` on the panel root. Existing: `unit-picker`, `unit-confirmed`, `unit-legacy`.

### Failure capture and timing
- Target config: `trace: "retain-on-failure"` (or `on-first-retry` in CI), `screenshot: "only-on-failure"`, `video: "retain-on-failure"`, reporters `list` + `html` (+ `github` on CI), `expect.timeout` 10 s, action 15 s, test 60 s. Add `playwright-report/` to `.gitignore` (`test-results/` is already ignored).
- **CI time (estimates, unmeasured):** the Next build is the dominant cost (several minutes, caching `.next/cache` helps). Tests: roughly 3 to 6 minutes serial for ~13 CAD tests plus the existing 7 specs. Build once, then run `next start`; do not use the `prod` script (it rebuilds) under Playwright.
- **Fixture management:** small committed DXFs plus the builder; do not import the 3,386-line `sample-house.dxf` except for one realistic smoke test.

### Illustrative sketch of the target config (not applied)

```ts
// playwright.config.ts (target shape, for discussion only)
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 2 : 0,
  failOnFlakyTests: !!process.env.CI,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }], ["github"]]
    : [["list"], ["html", { open: "never" }]],
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:3000",
    locale: "en-US",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        // Windows-only Chrome stays an opt-in local override, not the default.
        ...(process.env.PW_CHROME_PATH
          ? { launchOptions: { executablePath: process.env.PW_CHROME_PATH } }
          : {}),
      },
    },
  ],
  webServer: {
    command: process.env.CI ? "pnpm -F @vectroq/web start" : "pnpm -F @vectroq/web dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
```

### Illustrative sketch of a deterministic upload step (not applied)

```ts
const uploaded = page.waitForResponse(
  (r) => r.url().includes("/cad-upload") && r.request().method() === "POST",
);
await page.getByLabel("Upload AutoCAD file (.dxf)").setInputFiles(dxfPath);
const res = await uploaded;
expect(res.status()).toBe(200);
await expect(page.getByTestId("unit-picker")).toBeVisible();
```

---

## 9.7 CI integration recommendations

1. **Create a workflow** (none exists). Three jobs: `unit` (typecheck + `pnpm test`), `pg` (Postgres service + `TEST_DATABASE_URL` so the PG tests actually run), `e2e` (Postgres service, migrate, seed, build, `playwright install --with-deps chromium`, run).
2. **Triggers:** pull requests and pushes to `main` and `phase-*`. Run `@smoke` on PRs, the full suite on merge to `main` and nightly.
3. **Chromium only** at first (cookie `secure` and WebGL behaviour are unverified elsewhere).
4. **Secrets:** none needed if the blob seam (option B) and Cloudflare Turnstile's documented always-pass test keys are used. Verify those keys against Cloudflare's docs; note the server still calls Cloudflare's siteverify endpoint, a network dependency. Alternative: keep the public-form test out of the CI-required set. **Never put real blob or Stripe tokens in CI.**
5. **Artifacts:** upload `playwright-report/` and `test-results/` on failure (7 to 14 days).
6. **Caching:** pnpm store, `.next/cache`, Playwright browsers keyed by version. `concurrency` group to cancel superseded runs.
7. **Docs fix:** the header of `cad-concurrency.pg.test.ts` tells you to run `pnpm --filter web exec vitest ...`, but the package is named `@vectroq/web` *(likely wrong filter, unverified)*.

```yaml
# .github/workflows/e2e.yml  (proposal only, not applied)
name: e2e
on:
  pull_request:
  push: { branches: [main, "phase-*"] }
concurrency: { group: e2e-${{ github.ref }}, cancel-in-progress: true }
jobs:
  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17-alpine
        env: { POSTGRES_PASSWORD: test, POSTGRES_DB: vectroq_e2e_test }
        ports: ["54330:5432"]
        options: >-
          --health-cmd "pg_isready -U postgres" --health-interval 2s
          --health-timeout 3s --health-retries 20
    env:
      CI: "true"
      DATABASE_URL: postgresql://postgres:test@localhost:54330/vectroq_e2e_test
      DIRECT_URL: postgresql://postgres:test@localhost:54330/vectroq_e2e_test
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @vectroq/db exec prisma migrate deploy
      - run: pnpm --filter @vectroq/web build
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright
          path: |
            playwright-report
            test-results
```

---

## 9.8 Prioritized implementation roadmap

| Step | Work | Exit criterion | Needs approval for |
|---|---|---|---|
| **P0** Make the existing suite runnable | Single `@playwright/test` declaration; remove hard-coded Chrome path (opt-in env override); E2E DB from compose; Turnstile keys or exclude the public-form test; replace `waitForTimeout` with `page.clock`; update README | `pnpm test:e2e` passes twice in a row on a clean Linux clone against a fresh DB | config + test edits |
| **P1** Harness | global setup (migrate, shared rate seed, clear `RateLimit`); per-worker owner + `storageState`; `createProject` helper; DXF builder + 4 fixtures; trace/screenshot/reporter config; **decide blob option B or C** | a trivial CAD spec runs on seeded fixtures; teardown leaves a clean DB | small app change (blob seam, testids) |
| **P2** Phase 1B smoke (5 `@smoke` tests) | header-unit upload and price; unitless block then confirm; edit invalidates BOQ and demotes status; stale-tab conflict; `.dwg` error | 10 consecutive green runs with `--repeat-each=10` | none beyond P1 |
| **P3** Full Phase 1/1B suite + CI | remaining ~8 tests; GitHub Actions workflow with artifacts; PG tests with `TEST_DATABASE_URL` | PR check required and stable over a week | new workflow file |
| **P4** Phase 2 E2E | metamorphic tests written alongside `normalize-segments.ts` | tests fail before and pass after normalization | Phase 2 itself |
| **P5** Hardening | `workers: 2`, `failOnFlakyTests`, nightly full run, optional Firefox | flake rate near zero over two weeks | none |

### Decisions I need from you before implementation
1. **Blob strategy:** option B (storage seam) or C (SDK URL override, to be verified)?
2. **App changes:** OK to add the listed `data-testid`s and the blob seam?
3. **Turnstile:** use Cloudflare's test keys in CI, or keep the public-form test out of the required set?
4. **CI:** is GitHub Actions the right place (the repo has no workflows today)?
5. **Local Chrome:** keep your Windows Chrome as an env opt-in (`PW_CHROME_PATH`) and default to Playwright's Chromium?
6. **Server mode:** CI against the production build (as proposed); locally against `dev` (faster) or production?

**No implementation will start until you approve.**
