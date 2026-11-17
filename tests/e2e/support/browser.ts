// Picks the browser the E2E suite launches, so nobody has to set PW_CHROME_PATH
// by hand on every machine or in every new terminal.
//
// Order:
//   1. PW_CHROME_PATH, if set (always wins; use it to force a specific browser).
//   2. Playwright's own Chromium, if `playwright install chromium` was run.
//   3. A system Chrome or Edge in its standard install location.
//   4. Nothing: Playwright then fails with its usual "run playwright install"
//      message, which is the right instruction when no browser exists at all.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

function systemBrowserCandidates(): string[] {
  const env = process.env;
  if (process.platform === "win32") {
    const roots = [
      env.PROGRAMFILES,
      env["PROGRAMFILES(X86)"],
      env.LOCALAPPDATA,
    ].filter((r): r is string => !!r);
    return roots.flatMap((r) => [
      path.join(r, "Google", "Chrome", "Application", "chrome.exe"),
      path.join(r, "Microsoft", "Edge", "Application", "msedge.exe"),
    ]);
  }
  if (process.platform === "darwin")
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ];
  return [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
  ];
}

const exists = (p: string | undefined): p is string => {
  try {
    return !!p && fs.existsSync(p);
  } catch {
    return false;
  }
};

/** Absolute path to pass as `executablePath`, or undefined to use Playwright's default. */
export function resolveBrowserPath(): string | undefined {
  const forced = process.env.PW_CHROME_PATH;
  if (forced) return forced; // explicit choice, even if wrong: fail loudly, not silently
  let managed: string | undefined;
  try {
    managed = chromium.executablePath();
  } catch {
    managed = undefined;
  }
  if (exists(managed)) return undefined; // Playwright's own Chromium is installed
  return systemBrowserCandidates().find(exists);
}
