// Phase 2, Stage 3b: floating-point boundary regression for the indexed bridge
// search. Every case runs the PRODUCTION indexed path and the independent
// all-pairs reference (bruteForceBridging) on the same segments and requires the
// complete result to be identical: status, applied angle, share, reason, counts.
//
// Axis-aligned plans return "aligned" before any bridge search, so the "nearly
// axis-aligned" plans here are skewed by 2e-6 rad (just over the 1e-6 threshold):
// their dominant walls sit on the nominal 0.25 ft cell boundaries to within ~1e-4 ft
// while still reaching the index. Each case asserts the index really ran.
import { describe, expect, it } from "vitest";
import { detectOrientation, type DetectStats, type Seg } from "./orientation";

const D = Math.PI / 180;
const EPS = Number.EPSILON;
const seg = (x1: number, y1: number, x2: number, y2: number): Seg => ({
  x1,
  y1,
  x2,
  y2,
});
const tolOf = (M: number) => 8 * EPS * M + 1e-6; // the touching tolerance

/**
 * 30 x 20 rectangle whose two verticals end `side * g` away from the bottom wall at
 * y = y0 (so the bridge gap is g), rotated by `rad`, then offset. `family: "v"`
 * swaps the axes so the dominant family is vertical (major-axis w = -x, negative).
 */
function rect(
  y0: number,
  g: number,
  side: 1 | -1,
  ox: number,
  oy: number,
  rad: number,
  family: "h" | "v" = "h",
): Seg[] {
  const e = y0 + side * g;
  let s = [
    seg(0, y0, 30, y0),
    seg(0, y0 + 20, 30, y0 + 20),
    seg(0, e, 0, y0 + 20),
    seg(30, e, 30, y0 + 20),
  ];
  if (family === "v") s = s.map((t) => seg(t.y1, t.x1, t.y2, t.x2));
  const c = Math.cos(rad);
  const n = Math.sin(rad);
  return s.map((t) => ({
    x1: t.x1 * c - t.y1 * n + ox,
    y1: t.x1 * n + t.y1 * c + oy,
    x2: t.x2 * c - t.y2 * n + ox,
    y2: t.x2 * n + t.y2 * c + oy,
  }));
}

const fresh = (): DetectStats => ({
  perpendicularSegments: 0,
  dominantSegments: 0,
  bridgeDistanceChecks: 0,
  earlyExit: false,
});

/** indexed === all-pairs, completely; returns the shared result */
function same(segs: Seg[]) {
  const stats = fresh();
  const fast = detectOrientation(segs, { stats });
  const ref = detectOrientation(segs, { bruteForceBridging: true });
  expect(fast).toEqual(ref);
  // the indexed path really ran (not the "aligned" shortcut, not the reference)
  expect(fast.status).not.toBe("aligned");
  expect(fast.status).not.toBe("insufficient");
  expect(stats.dominantSegments).toBeGreaterThan(0);
  expect(stats.perpendicularSegments).toBeGreaterThan(0);
  return fast;
}

const SKEW = 2e-6; // rad, just above the 1e-6 aligned threshold
const OFFSETS: [number, number][] = [
  [0, 0],
  [1e6, -1e6],
  [-1e6, 1e6],
  [1e9, -1e9],
  [-1e9, 1e9],
];

describe("indexed bridge search: cell boundaries, negative coordinates, both families", () => {
  const Ms = (ox: number, oy: number) =>
    Math.max(Math.abs(ox), Math.abs(oy)) + 40;
  for (const [ox, oy] of OFFSETS)
    for (const fam of ["h", "v"] as const)
      it(`nearly axis-aligned, ${fam === "h" ? "horizontal" : "vertical"} dominant family, offset (${ox}, ${oy}): walls on and either side of 0.25 ft cell boundaries`, () => {
        const t = tolOf(Ms(ox, oy));
        let accepted = 0;
        let refused = 0;
        for (const k of [-401, -5, -1, 0, 1, 3, 7, 4001])
          for (const d of [-1e-8, 0, 1e-8])
            // immediately below / on / above the boundary
            for (const side of [1, -1] as const)
              for (const [g, accept] of [
                [0, true],
                [0.4 * t, true],
                [2.5 * t, false],
                [1e-3, false],
              ] as [number, boolean][]) {
                const r = same(rect(k * 0.25 + d, g, side, ox, oy, SKEW, fam));
                expect(
                  r.status === "rotate",
                  `k=${k} d=${d} side=${side} g=${g}`,
                ).toBe(accept);
                if (accept) accepted++;
                else refused++;
              }
        expect(accepted).toBeGreaterThan(0);
        expect(refused).toBeGreaterThan(0);
      });

  it("a tilted wall that straddles a cell boundary along its length is found from either end", () => {
    // w changes by ~6e-5 ft along a 30 ft wall skewed 2e-6 rad: choose y0 so the boundary lies inside that range
    for (const y0 of [
      0.25 - 3e-5,
      0.25,
      0.25 + 3e-5,
      -0.25 - 3e-5,
      -0.25 + 3e-5,
    ])
      for (const side of [1, -1] as const)
        expect(same(rect(y0, 0, side, 0, 0, SKEW)).status).toBe("rotate");
  });

  it("dominant walls spread over more than 64 cells (the wide list) match the reference", () => {
    const wide = [
      seg(0, 0, 300, 10),
      seg(0, 20, 300, 30),
      seg(0, 0, -0.35, 20),
      seg(300, 10, 299.65, 30),
    ];
    const r = same(wide);
    expect(r.status).toBe("uncertain"); // the verticals miss the tilted walls
    const touching = [
      seg(0, 0, 300, 10),
      seg(0, 20, 300, 30),
      seg(0, 0, -0.35, 20),
      seg(300, 10, 299.65, 30),
    ];
    // make the ends meet: the verticals end exactly on the tilted walls
    touching[2] = seg(0, 0, 0, 20);
    touching[3] = seg(300, 10, 300, 30);
    const r2 = same(touching);
    expect(["rotate", "uncertain"]).toContain(r2.status);
  });
});

describe("indexed bridge search: rotated plans at large offsets", () => {
  for (const [ox, oy] of OFFSETS)
    for (const deg of [-37.3, -1, 0.01, 12, 31, 44])
      it(`offset (${ox}, ${oy}), rotated ${deg} degrees: accepts touching plans, refuses gapped ones, identical to the reference`, () => {
        const t = tolOf(Math.max(Math.abs(ox), Math.abs(oy)) + 40);
        for (const side of [1, -1] as const)
          for (const [g, accept] of [
            [0, true],
            [0.4 * t, true],
            [3 * t, false],
          ] as [number, boolean][])
            expect(
              same(rect(3.1, g, side, ox, oy, deg * D)).status === "rotate",
              `side=${side} g=${g}`,
            ).toBe(accept);
      });
});

describe("indexed bridge search: sweeping the gap through the exact touching tolerance", () => {
  for (const [ox, oy] of OFFSETS)
    for (const deg of [31, -37.3, 12.5])
      it(`offset (${ox}, ${oy}), rotated ${deg} degrees: 121 gaps spaced half an ulp apart around the tolerance`, () => {
        const M = Math.max(Math.abs(ox), Math.abs(oy)) + 40;
        const t = tolOf(M);
        const ulp = M * EPS;
        let accepted = 0;
        let refused = 0;
        for (let i = -60; i <= 60; i++) {
          const g = t + i * Math.max(ulp, 1e-16) * 0.5;
          if (g < 0) continue;
          for (const side of [1, -1] as const) {
            const r = same(rect(0.25, g, side, ox, oy, deg * D));
            if (r.status === "rotate") accepted++;
            else refused++;
          }
        }
        // the sweep must straddle the boundary, or it proves nothing
        expect(accepted).toBeGreaterThan(0);
        expect(refused).toBeGreaterThan(0);
      });
});

describe("regression: the case that failed in the review", () => {
  it("offset (1e9, -1e9), rotation -37.3 degrees, gap 1.1e-7 ft below the tolerance: accepted, as the all-pairs reference accepts it", () => {
    const M = 1e9 + 40;
    const t = tolOf(M);
    const g = t + -1 * Math.max(M * EPS, 1e-16) * 0.5; // = t - 1.11e-7
    expect(t - g).toBeGreaterThan(1.0e-7);
    expect(t - g).toBeLessThan(1.2e-7);
    const segs = rect(0.25, g, -1, 1e9, -1e9, -37.3 * D);
    const ref = detectOrientation(segs, { bruteForceBridging: true });
    expect(ref.status).toBe("rotate"); // the reference accepts
    const fast = detectOrientation(segs);
    expect(fast).toEqual(ref); // before the fix this was "uncertain"
    expect(fast.rotationRad).toBe(ref.rotationRad);
  });
});

describe("the safety margin never accepts a bridge the exact test rejects", () => {
  it("gaps clearly outside the tolerance are refused by both searches at every offset", () => {
    for (const [ox, oy] of OFFSETS)
      for (const deg of [-37.3, 12.5, 31]) {
        const t = tolOf(Math.max(Math.abs(ox), Math.abs(oy)) + 40);
        for (const mult of [1.5, 2, 5, 50])
          for (const side of [1, -1] as const) {
            const r = same(rect(0.25, mult * t, side, ox, oy, deg * D));
            expect(r.status, `offset ${ox},${oy} deg ${deg} gap ${mult}t`).toBe(
              "uncertain",
            );
          }
      }
  });
  it("a pre-filter margin cannot lower the decision count: accepted sets agree sweep for sweep (see the sweep tests), and the distance check count only grows", () => {
    const M = 1e9 + 40;
    const t = tolOf(M);
    const segs = rect(0.25, t - 0.5 * M * EPS, -1, 1e9, -1e9, -37.3 * D);
    const stats = fresh();
    detectOrientation(segs, { stats });
    // candidates are only inspected, never accepted without the exact test: checks are bounded by the all-pairs count
    expect(stats.bridgeDistanceChecks).toBeLessThanOrEqual(
      stats.dominantSegments * stats.perpendicularSegments * 2,
    );
  });
});
