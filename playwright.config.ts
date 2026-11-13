import { defineConfig } from "@playwright/test";

const isHeadedMode = process.argv.includes("--headed");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: (
    globalThis as typeof globalThis & { process?: { env?: { CI?: string } } }
  ).process?.env?.CI
    ? 2
    : 0,

  webServer: [
    {
      command: "pnpm -F @vectroq/web prod",
      url: "http://localhost:3000",
      name: "Frontend",
      reuseExistingServer: !process.env.CI,
    },
  ],

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    launchOptions: {
      slowMo: isHeadedMode ? 500 : 0,
      executablePath:
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    },
  },
});
