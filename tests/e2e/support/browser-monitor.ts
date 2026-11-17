// Watches one page for problems that a passing assertion would otherwise hide:
// uncaught exceptions, console errors, failed same-origin requests and same-origin
// HTTP 4xx/5xx responses.
//
// Deliberately narrow. These are NOT failures:
//  - requests to other origins (Google Fonts, the Turnstile widget) and the
//    console "Failed to load resource" lines they produce;
//  - aborted requests (a reload cancels the ones in flight);
//  - WebGL / GPU / THREE.js messages (headless Chrome renders WebGL in software
//    and logs driver notes and deprecations that say nothing about the app).
// Everything else fails the test. Whatever was ignored is attached to the test
// report, so a rule that is too loose can be seen and tightened.
import type { Page, TestInfo } from "@playwright/test";
import { expect } from "@playwright/test";

const WEBGL_NOISE = /WebGL|GL Driver Message|GPU stall|swiftshader|THREE\./i;
const ABORTED = /ERR_ABORTED|NS_BINDING_ABORTED/;

export function watchBrowser(page: Page, baseURL: string, testInfo: TestInfo) {
  const origin = new URL(baseURL).origin;
  const problems: string[] = [];
  const ignored: string[] = [];

  page.on("pageerror", (e) =>
    problems.push(`uncaught exception: ${e.message}`),
  );
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const url = m.location().url;
    const line = `console.error: ${m.text()}${url ? `  [${url}]` : ""}`;
    const external = url !== "" && !url.startsWith(origin);
    if (WEBGL_NOISE.test(m.text()) || external) ignored.push(line);
    else problems.push(line);
  });
  page.on("requestfailed", (r) => {
    if (!r.url().startsWith(origin)) return;
    const why = r.failure()?.errorText ?? "unknown";
    const line = `request failed: ${r.method()} ${r.url()} (${why})`;
    if (ABORTED.test(why)) ignored.push(line);
    else problems.push(line);
  });
  page.on("response", (r) => {
    if (!r.url().startsWith(origin) || r.status() < 400) return;
    problems.push(`HTTP ${r.status()}: ${r.request().method()} ${r.url()}`);
  });

  return {
    /** Call at the end of the test. Always attaches what was ignored. */
    async assertClean() {
      await testInfo.attach("browser-monitor-ignored.txt", {
        body: ignored.length ? ignored.join("\n") : "(nothing ignored)",
        contentType: "text/plain",
      });
      expect(
        problems,
        `browser problems seen during the test:\n${problems.join("\n")}`,
      ).toEqual([]);
    },
  };
}
