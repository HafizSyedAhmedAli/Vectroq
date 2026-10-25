import { describe, it, expect } from "vitest";
import { CATEGORY_FINISH, finishSummary } from "./finishes";

describe("CATEGORY_FINISH", () => {
  it("defines A, B and C with hex colours", () => {
    for (const k of ["A", "B", "C"] as const) {
      const f = CATEGORY_FINISH[k];
      for (const c of [f.doorColor, f.woodColor, f.cabinetColor, f.sofaColor, f.beddingColor])
        expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
  it("ceiling and counter follow the category tier", () => {
    expect(CATEGORY_FINISH.A).toMatchObject({ ceiling: "tray", counter: "granite" });
    expect(CATEGORY_FINISH.B).toMatchObject({ ceiling: "drop", counter: "granite" });
    expect(CATEGORY_FINISH.C).toMatchObject({ ceiling: "plain", counter: "laminate" });
  });
});

describe("finishSummary", () => {
  it("describes premium marble finishes", () => {
    expect(finishSummary("A", "marble")).toEqual([
      "Marble in dry rooms; kitchen and baths tiled",
      "Stepped false ceiling with cove light",
      "Granite kitchen counter",
      "Walnut doors (illustrative)",
    ]);
  });
  it("describes standard tile finishes", () => {
    expect(finishSummary("B", "tile")).toEqual([
      "Tile flooring throughout",
      "False ceiling with dropped border",
      "Granite kitchen counter",
      "Oak doors (illustrative)",
    ]);
  });
  it("describes economy finishes", () => {
    const s = finishSummary("C", "tile");
    expect(s[1]).toBe("Plain false ceiling");
    expect(s[2]).toBe("Laminate kitchen counter");
    expect(s[3]).toBe("Painted doors (illustrative)");
  });
});
