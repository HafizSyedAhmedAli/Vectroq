// The PostgreSQL integration tests are skipped by Vitest when TEST_DATABASE_URL is
// unset, which still exits 0. This makes the CI job fail unless they really ran.
import fs from "node:fs";

const file = process.argv[2] ?? "pg-results.json";
const r = JSON.parse(fs.readFileSync(file, "utf8"));
const pg = r.testResults.filter((f) => /\.pg\.test\.[cm]?[jt]sx?$/.test(f.name));
const count = (s) => pg.flatMap((f) => f.assertionResults).filter((t) => t.status === s).length;
const [passed, failed, skipped] = [count("passed"), count("failed"), count("pending") + count("skipped") + count("todo")];
const md = `### PostgreSQL integration tests\n\n| Result | Tests |\n|---|---|\n| Passed | ${passed} |\n| Failed | ${failed} |\n| Skipped | ${skipped} |\n`;
console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");
if (pg.length === 0 || passed === 0 || failed > 0 || skipped > 0) {
  console.error("::error::PostgreSQL integration tests did not all run and pass.");
  process.exit(1);
}
