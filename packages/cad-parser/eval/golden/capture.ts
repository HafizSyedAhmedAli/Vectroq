// One-off capture. Run ONLY against the unmodified Stage 3b baseline:
//   git rev-parse HEAD   -> 10f8ad0...
//   tsx eval/golden/capture.ts
// It records the current output of every corpus case. Do not re-run it to make
// a failing preservation test pass.
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { goldenCorpus } from "./corpus";

const sha = execSync("git rev-parse HEAD").toString().trim();
const dirty = execSync("git status --porcelain -- packages/cad-parser/src")
  .toString()
  .trim();
if (dirty) throw new Error("src is modified; capture needs the baseline code");
const out: Record<string, unknown> = {};
for (const c of goldenCorpus()) {
  const { geometry, meta } = c.run();
  out[c.name] = { mode: c.mode, trusted: c.trusted, geometry, meta };
}
writeFileSync(
  join(__dirname, "golden-baseline.json"),
  JSON.stringify({ baselineCommit: sha, cases: out }, null, 2) + "\n",
);
console.log("captured", Object.keys(out).length, "cases at", sha);
