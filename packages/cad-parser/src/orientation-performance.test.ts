// Phase 2, Stage 3b corrections: the bridge search is indexed, not all-pairs.
// Complexity is asserted with deterministic operation counts (never wall-clock
// time), and the indexed search is checked to make exactly the decisions of the
// original all-pairs search on fixtures, shapes and generated plans.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import DxfParser from "dxf-parser";
import { FIXTURES } from "../eval/fixtures";
import {
  detectOrientation,
  wallSegmentsOf,
  type DetectStats,
  type Seg,
} from "./orientation";

const D = Math.PI / 180;
type P = [number, number];
const rot = (segs: Seg[], a: number): Seg[] =>
  segs.map((s) => ({
    x1: s.x1 * Math.cos(a) - s.y1 * Math.sin(a),
    y1: s.x1 * Math.sin(a) + s.y1 * Math.cos(a),
    x2: s.x2 * Math.cos(a) - s.y2 * Math.sin(a),
    y2: s.x2 * Math.sin(a) + s.y2 * Math.cos(a),
  }));
const seg = (p: P, q: P): Seg => ({ x1: p[0], y1: p[1], x2: q[0], y2: q[1] });

const fresh = (): DetectStats => ({
  perpendicularSegments: 0,
  dominantSegments: 0,
  bridgeDistanceChecks: 0,
  earlyExit: false,
});

/** Same decision, same applied angle, same explanation, bit for bit. */
function expectSameDecision(segs: Seg[]) {
  const fast = detectOrientation(segs);
  const ref = detectOrientation(segs, { bruteForceBridging: true });
  expect(fast).toEqual(ref);
  return fast;
}

// ---- synthetic drawings of a given size
/** Long walls that never touch their neighbours: the detector must scan everything and refuse. */
const nonTouching = (n: number): Seg[] => {
  const out: Seg[] = [];
  for (let i = 0; i < n / 2; i++) {
    out.push(seg([0, i * 0.5], [100, i * 0.5]));
    out.push(seg([i * 0.033, 0], [i * 0.033, 1500]));
  }
  return out;
};
/** A lattice whose every wall touches its neighbours: a genuine building outline. */
const lattice = (n: number): Seg[] => {
  const rows = Math.round(Math.sqrt(n / 2) * 0.9);
  const cols = Math.round(n / 2 / rows);
  const out: Seg[] = [];
  for (let j = 0; j <= rows; j++)
    out.push(seg([0, j * 10], [cols * 10, j * 10]));
  for (let i = 0; i <= cols; i++)
    out.push(seg([i * 10, 0], [i * 10, rows * 10]));
  return out;
};

const SIZES = [3000, 6000, 12000];

describe("bridge search complexity (operation counts, not time)", () => {
  const checks: Record<string, number[]> = { nonTouching: [], lattice: [] };

  for (const n of SIZES) {
    it(`non-touching walls, ${n} segments: refused, with a candidate count linear in the segment count`, () => {
      const segs = rot(nonTouching(n), 12 * D);
      const stats = fresh();
      const t0 = Date.now();
      const r = detectOrientation(segs, { stats });
      const ms = Date.now() - t0;
      expect(r.status).not.toBe("rotate");
      expect(r.eligibleSegments).toBe(n);
      // the all-pairs search needs dominant x perpendicular x 2 checks
      const allPairs = stats.dominantSegments * stats.perpendicularSegments * 2;
      expect(stats.bridgeDistanceChecks).toBeLessThanOrEqual(
        40 * stats.perpendicularSegments,
      );
      expect(stats.bridgeDistanceChecks).toBeLessThan(allPairs / 50);
      checks.nonTouching.push(
        stats.bridgeDistanceChecks / stats.perpendicularSegments,
      );
      // timing is informational only
      console.info(
        `[info] non-touching ${n}: ${stats.bridgeDistanceChecks} distance checks (all-pairs would need ${allPairs}), ${ms} ms`,
      );
    });

    it(`lattice building, ${n} segments: accepted, and the search stops early`, () => {
      const segs = rot(lattice(n), -23 * D);
      const stats = fresh();
      const r = detectOrientation(segs, { stats });
      expect(r.status).toBe("rotate");
      expect(r.detectedRad).toBeCloseTo(-23 * D, 9);
      expect(stats.earlyExit).toBe(true);
      expect(stats.bridgeDistanceChecks).toBeLessThanOrEqual(
        40 * stats.perpendicularSegments,
      );
      // early exit means a tiny fraction of the perpendicular segments is examined
      expect(stats.bridgeDistanceChecks).toBeLessThan(2000);
      checks.lattice.push(stats.bridgeDistanceChecks);
    });
  }

  it("checks per perpendicular segment do not grow with drawing size (linear overall)", () => {
    const per = checks.nonTouching;
    expect(per).toHaveLength(3);
    expect(Math.max(...per) / Math.min(...per)).toBeLessThan(3);
  });
});

describe("indexed search = all-pairs search (exact same decision and angle)", () => {
  for (const n of [3000, 6000]) {
    it(`non-touching ${n}`, () =>
      expectSameDecision(rot(nonTouching(n), 12 * D)));
    it(`lattice ${n}`, () => expectSameDecision(rot(lattice(n), -23 * D)));
  }

  it("the four repository fixtures (as drawn, and rotated 17 degrees)", () => {
    for (const f of FIXTURES) {
      const dxf = new DxfParser().parseSync(readFileSync(f.path, "utf8"))!;
      const segs = wallSegmentsOf(dxf.entities as any[]);
      expect(segs.length).toBeGreaterThan(0);
      expectSameDecision(segs);
      expectSameDecision(rot(segs, 17 * D));
    }
  });

  const R = (w: number, h: number): P[] => [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  const edges = (poly: P[]): Seg[] =>
    poly.map((p, i) => seg(p, poly[(i + 1) % poly.length]));
  const shapes: [string, Seg[]][] = [
    ["rectangle", edges(R(30, 20))],
    ["square", edges(R(20, 20))],
    ["narrow", edges(R(200, 1.5))],
    [
      "L",
      edges([
        [0, 0],
        [30, 0],
        [30, 10],
        [15, 10],
        [15, 20],
        [0, 20],
      ]),
    ],
    [
      "U",
      edges([
        [0, 0],
        [30, 0],
        [30, 20],
        [20, 20],
        [20, 8],
        [10, 8],
        [10, 20],
        [0, 20],
      ]),
    ],
    [
      "plus",
      edges([
        [10, 0],
        [20, 0],
        [20, 10],
        [30, 10],
        [30, 20],
        [20, 20],
        [20, 30],
        [10, 30],
        [10, 20],
        [0, 20],
        [0, 10],
        [10, 10],
      ]),
    ],
    [
      "door gaps",
      [
        seg([0, 0], [8, 0]),
        seg([11, 0], [30, 0]),
        seg([30, 0], [30, 7]),
        seg([30, 10], [30, 20]),
        seg([30, 20], [18, 20]),
        seg([15, 20], [0, 20]),
        seg([0, 20], [0, 12]),
        seg([0, 9], [0, 0]),
      ],
    ],
    [
      "overshoot 0.5",
      [
        seg([-0.5, 0], [30.5, 0]),
        seg([-0.5, 20], [30.5, 20]),
        seg([0, -0.5], [0, 20.5]),
        seg([30, -0.5], [30, 20.5]),
      ],
    ],
    [
      "overshoot 1e-4",
      [
        seg([-1e-4, 0], [30 + 1e-4, 0]),
        seg([-1e-4, 20], [30 + 1e-4, 20]),
        seg([0, -1e-4], [0, 20 + 1e-4]),
        seg([30, -1e-4], [30, 20 + 1e-4]),
      ],
    ],
    [
      "chamfer",
      edges([
        [0, 0],
        [30, 0],
        [30, 10],
        [20, 20],
        [0, 20],
      ]),
    ],
    [
      "comb",
      [
        seg([0, 0], [60, 0]),
        seg([0, 0], [0, 5]),
        seg([30, 0], [30, 5]),
        seg([60, 0], [60, 5]),
      ],
    ],
    ["parallel only", [0, 5, 10, 15].map((y) => seg([0, y], [30, y]))],
    [
      "diagonal clutter",
      [...edges(R(30, 20)), seg([0, 0], [27, 13]), seg([100, 100], [103, 104])],
    ],
  ];
  for (const [name, segs] of shapes)
    for (const deg of [0, 0.01, 20, -33, 44.9])
      it(`${name} at ${deg} degrees`, () =>
        expectSameDecision(rot(segs, deg * D)));

  it("300 generated plans: boxes, noise, gaps, strays, offsets, duplicates", () => {
    let s = 12345;
    const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
    const decisions = new Set<string>();
    for (let k = 0; k < 300; k++) {
      const segs: Seg[] = [];
      const boxes = 1 + Math.floor(rnd() * 4);
      for (let b = 0; b < boxes; b++) {
        const x = rnd() * 60;
        const y = rnd() * 60;
        const w = 5 + rnd() * 40;
        const h = 5 + rnd() * 40;
        const gap = rnd() < 0.3 ? rnd() * 0.2 : 0;
        const over = rnd() < 0.15 ? rnd() * 0.01 : 0;
        segs.push(
          seg([x + gap, y], [x + w - gap, y]),
          seg([x + w, y - over], [x + w, y + h + over]),
          seg([x + w, y + h], [x, y + h]),
          seg([x, y + h + over], [x, y - over]),
        );
        if (rnd() < 0.3) segs.push(seg([x, y + h / 2], [x + w, y + h / 2]));
      }
      for (let q = Math.floor(rnd() * 4); q > 0; q--)
        segs.push(seg([rnd() * 90, rnd() * 90], [rnd() * 90, rnd() * 90]));
      if (rnd() < 0.2) segs.push(...segs.slice(0, 4)); // exact duplicates
      const off = rnd() < 0.2 ? 1e5 * rnd() : 0;
      const a = (rnd() * 180 - 90) * D;
      const placed = rot(segs, a).map((t) => ({
        x1: t.x1 + off,
        y1: t.y1 + off,
        x2: t.x2 + off,
        y2: t.y2 + off,
      }));
      const out = expectSameDecision(placed);
      decisions.add(out.status);
    }
    // the generator must exercise accept AND refuse paths for the comparison to mean anything
    expect(decisions.has("rotate")).toBe(true);
    expect(
      [...decisions].some((d) => d === "uncertain" || d === "insufficient"),
    ).toBe(true);
  });
});

describe("large inputs do not overflow the call stack", () => {
  it("96,000 coordinates in one detection do not throw", () => {
    const segs = rot(nonTouching(24000), 7 * D);
    expect(() => detectOrientation(segs)).not.toThrow();
  });
});
