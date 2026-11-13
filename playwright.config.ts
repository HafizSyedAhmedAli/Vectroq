import { defineConfig, devices } from "@playwright/test";

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

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: isCI ? 2 : 0,

  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: [["list"], ["html", { open: "never" }]],

  webServer: [
    {
      command: useProdServer
        ? "pnpm -F @vectroq/web start"
        : "pnpm -F @vectroq/web dev",
      url: "http://localhost:3000",
      name: "Frontend",
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
  ],

  use: {
    baseURL: "http://localhost:3000",
    // Failure artifacts land in test-results/ and playwright-report/ (both git-ignored).
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          slowMo: isHeadedMode ? 500 : 0,
          ...(chromePath ? { executablePath: chromePath } : {}),
        },
      },
    },
  ],
});
