// One-off: BOQ quantities computed from the CAPTURED baseline geometry
// (cad-parser/eval/golden/golden-baseline.json, taken at the Stage 3b commit).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { boqQuantities } from "./boq-quantities";

const base = JSON.parse(
  readFileSync(
    join(__dirname, "../../cad-parser/eval/golden/golden-baseline.json"),
    "utf8",
  ),
);
const out: Record<string, unknown> = {};
for (const [name, c] of Object.entries<any>(base.cases))
  out[name] = boqQuantities(c.geometry);
writeFileSync(
  join(__dirname, "boq-golden.json"),
  JSON.stringify({ baselineCommit: base.baselineCommit, cases: out }, null, 2) +
    "\n",
);
console.log("boq golden", Object.keys(out).length);
