// Phase 2 Stage 3a: what merging overlapping Mode B wall lines does to the BOQ
// quantities. Gross wall area must fall only by the duplicate run that was
// removed, openings are deducted exactly once, and a drawing with no overlaps
// prices exactly as before. (The "before" side is the previous pipeline: unit
// not trusted = no merging.)
import { describe, expect, it } from "vitest";
import { dxfToGeometry, ParseReport } from "@vectroq/cad-parser";
import {
  brickCount,
  netWallArea,
  openingArea,
  plasterArea,
  wallFaceArea,
} from "./index";

type P = [number, number];
const line = (layer: string, a: P, b: P) => ({
  type: "LINE",
  layer,
  vertices: [
    { x: a[0], y: a[1] },
    { x: b[0], y: b[1] },
  ],
});
const W = (a: P, b: P) => line("WALLS", a, b);
const HEIGHT = 10; // DEFAULT_CONSTRUCTION.wallHeightFt

function both(entities: unknown[]) {
  const report = new ParseReport();
  const after = dxfToGeometry({ entities } as never, undefined, {
    report,
    unitTrusted: true,
  });
  const before = dxfToGeometry({ entities } as never, undefined, {
    unitTrusted: false,
  });
  return { before, after, stats: report.toMeta({} as never).stats };
}
const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 9);

describe("BOQ quantities after merging overlapping wall lines", () => {
  const overlap = [
    W([0, 0], [10, 0]),
    W([6, 0], [16, 0]), // 4 ft of this lies on the first wall
    W([16, 0], [16, 8]),
    line("DOORS", [2, 0], [5, 0]), // 3 x 7 = 21
    line("WINDOWS", [12, 0], [14, 0]), // 2 x 4 = 8
  ];

  it("gross wall area falls by exactly the removed duplicate run", () => {
    const { before, after, stats } = both(overlap);
    expect(wallFaceArea(before)).toBe((10 + 10 + 8) * HEIGHT);
    expect(wallFaceArea(after)).toBe((16 + 8) * HEIGHT);
    expect(stats.wallLengthRemovedFt).toBe(4);
    close(
      wallFaceArea(before) - wallFaceArea(after),
      stats.wallLengthRemovedFt * HEIGHT,
    );
  });

  it("openings are unchanged and deducted exactly once", () => {
    const { before, after } = both(overlap);
    expect(openingArea(before)).toBe(29);
    expect(openingArea(after)).toBe(29);
    expect(after.openings).toHaveLength(2);
    expect(netWallArea(after)).toBe(wallFaceArea(after) - 29); // not 58
    close(
      netWallArea(before) - netWallArea(after),
      wallFaceArea(before) - wallFaceArea(after),
    );
  });

  it("walls stay gross and continuous through the openings", () => {
    const { after } = both(overlap);
    // the bottom run is one 16 ft wall; the door and window do not split it
    const bottom = after.walls.filter((w) => w.startY === 0 && w.endY === 0);
    expect(bottom).toHaveLength(1);
    expect(bottom[0].length).toBe(16);
  });

  it("derived quantities move only with the removed length", () => {
    const { before, after } = both(overlap);
    expect(plasterArea(after)).toBe(netWallArea(after) * 2);
    expect(brickCount(after)).toBeLessThan(brickCount(before));
  });

  it("a drawing without overlaps prices exactly as before", () => {
    const { before, after, stats } = both([
      W([0, 0], [20, 0]),
      W([20, 0], [20, 12]),
      W([20, 12], [0, 12]),
      W([0, 12], [0, 0]),
      W([10, 0], [10, 12]),
      line("DOORS", [4, 0], [7, 0]),
      line("WINDOWS", [14, 12], [17, 12]),
    ]);
    expect(stats.wallsMerged).toBeUndefined();
    expect(after).toEqual(before);
    for (const f of [
      wallFaceArea,
      openingArea,
      netWallArea,
      plasterArea,
      brickCount,
    ])
      expect(f(after)).toBe(f(before));
  });
});
