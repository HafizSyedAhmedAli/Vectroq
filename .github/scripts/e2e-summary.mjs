// Reads Playwright's JSON report, prints a Passed/Failed/Skipped/Flaky table to the
// job summary, and exits 1 if any test failed, was skipped, or if nothing ran.
// Flaky tests (failed, then passed on retry) pass the job but are called out.
import fs from "node:fs";

const file = process.argv[2] ?? "e2e-results.json";
if (!fs.existsSync(file)) {
  console.error(`::error::${file} not found: Playwright did not produce a report.`);
  process.exit(1);
}
const { stats } = JSON.parse(fs.readFileSync(file, "utf8"));
const rows = [
  ["Passed", stats.expected],
  ["Failed", stats.unexpected],
  ["Flaky (passed on retry)", stats.flaky],
  ["Skipped", stats.skipped],
];
const md = ["### Playwright E2E", "", "| Result | Tests |", "|---|---|", ...rows.map(([k, v]) => `| ${k} | ${v} |`), ""].join("\n");
console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");

let bad = false;
if (stats.expected + stats.unexpected + stats.flaky + stats.skipped === 0) {
  console.error("::error::No tests ran."); bad = true;
}
if (stats.unexpected > 0) { console.error(`::error::${stats.unexpected} test(s) failed.`); bad = true; }
if (stats.skipped > 0) { console.error(`::error::${stats.skipped} test(s) were skipped or did not run (for example because an earlier setup test failed). The suite must not skip silently.`); bad = true; }
if (stats.flaky > 0) console.warn(`::warning::${stats.flaky} test(s) only passed on retry (flaky). Investigate.`);
process.exit(bad ? 1 : 0);
