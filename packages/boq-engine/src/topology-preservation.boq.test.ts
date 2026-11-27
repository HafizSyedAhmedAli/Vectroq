// Stage 3c-0: BOQ quantities for the golden corpus must equal the values computed
// from the geometry captured at the unmodified Stage 3b commit (golden/boq-golden.json).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { goldenCorpus } from "../../cad-parser/eval/golden/corpus";
import { boqQuantities } from "../golden/boq-quantities";

const GOLDEN = JSON.parse(
  readFileSync(join(__dirname, "../golden/boq-golden.json"), "utf8"),
) as {
  baselineCommit: string;
  cases: Record<string, any>;
};
const round = <T>(x: T): T => JSON.parse(JSON.stringify(x));

describe("BOQ quantities are unchanged by Stage 3c-0", () => {
  it("golden was captured at the Stage 3b commit", () => {
    expect(GOLDEN.baselineCommit).toBe(
      "10f8ad0223181fdfff9e0caaa7e86c9628fd6792",
    );
  });
  for (const c of goldenCorpus())
    it(c.name, () => {
      const q = round(boqQuantities(c.run().geometry as never));
      const g = GOLDEN.cases[c.name];
      expect(q).toEqual(g);
      for (const k of [
        "wallFaceArea",
        "openingArea",
        "netWallArea",
        "plasterArea",
        "floorArea",
        "brickCount",
      ])
        expect(q[k], k).toBe(g[k]);
      expect(q.boq.total).toBe(g.boq.total);
    });
});
