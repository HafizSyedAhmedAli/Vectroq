import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: (
    globalThis as typeof globalThis & { process?: { env?: { CI?: string } } }
  ).process?.env?.CI
    ? 2
    : 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    launchOptions: {
      executablePath:
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    },
  },
});
