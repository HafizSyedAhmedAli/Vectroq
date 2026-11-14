import { defineConfig, devices } from "@playwright/test";
import {
  E2E_BASE_URL,
  appServerEnv,
} from "./tests/e2e/support/env";

const isCI = !!process.env.CI;

// Server mode.
//   dev  (default locally): `next dev`. No build step, so the loop is fast, but
//        it is NOT what ships: NODE_ENV is "development".
//   prod (CI, or E2E_PROD=1): `next start` on an existing build. NODE_ENV is
//        "production", which changes behaviour the tests can see (Turnstile fails
//        closed without a secret, session cookies are `secure`).
// `next start` needs `pnpm --filter @vectroq/web build` to have run first; it is
// deliberately not run here, so a build is never repeated on every test run.
const useProdServer = isCI || process.env.E2E_PROD === "1";

// Optional local override of the browser (e.g. a system Chrome). Unset = the
// Chromium that `playwright install chromium` downloads.
const chromePath = process.env.PW_CHROME_PATH;

const isHeadedMode = process.argv.includes("--headed");

// Shared by every project, so PW_CHROME_PATH applies to the setup project too.
const launchOptions = {
  slowMo: isHeadedMode ? 500 : 0,
  ...(chromePath ? { executablePath: chromePath } : {}),
};

// Fails here, before anything starts, unless E2E_DATABASE_URL is a local *_test
// database. The harness never uses DATABASE_URL from your shell or .env.
const serverEnv = appServerEnv();

export default defineConfig({
  testDir: "./tests/e2e",
  // Verifies the database, migrates, resets and seeds it (see tests/e2e/support).
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: isCI ? 2 : 0,
  // A committed `test.only` must fail CI instead of quietly shrinking the suite.
  forbidOnly: isCI,

  // `next dev` compiles each route on its first visit, so a test that opens a
  // heavy page for the first time needs more headroom than against a build.
  timeout: useProdServer ? 60_000 : 120_000,
  expect: { timeout: 10_000 },

  reporter: [
    ["list"],
    ["html", { open: "never" }],
    // CI also writes machine-readable results, so the workflow can fail on any
    // skipped test and report flaky (retried) ones. See .github/scripts.
    ...(isCI ? ([["json", { outputFile: "e2e-results.json" }]] as const) : []),
  ],

  webServer: [
    {
      command: useProdServer
        ? "pnpm -F @vectroq/web start"
        : "pnpm -F @vectroq/web dev",
      url: E2E_BASE_URL,
      name: "Frontend",
      // Never reuse a server that is already running: its database and keys are
      // unknown, so it could be pointed at a development database.
      reuseExistingServer: false,
      env: serverEnv,
      timeout: 120_000,
    },
  ],

  use: {
    baseURL: E2E_BASE_URL,
    // Failure artifacts land in test-results/ and playwright-report/ (both git-ignored).
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    // Signs up the deterministic owner once and saves its session.
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
      use: { ...devices["Desktop Chrome"], launchOptions },
    },
    {
      name: "chromium",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        launchOptions,
      },
    },
  ],
});
