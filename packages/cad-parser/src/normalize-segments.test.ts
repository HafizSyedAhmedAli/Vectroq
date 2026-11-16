import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  DEFAULT_MERGE_OPTIONS,
  mergeCollinear,
  totalLength,
  type MergeInputSeg,
  type MergeResult,
} from "./normalize-segments";
import { parseDxf } from "./parse-dxf";

// ---------------------------------------------------------------- helpers

const TOL = 0.05; // ft, explicit in every tolerance-sensitive test (a CANDIDATE value, not approved)
const ANG = (0.5 * Math.PI) / 180;
const OPTS = { offsetTol: TOL, angleTolRad: ANG, minOverlap: 0.1 };

function S(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  extra: Partial<MergeInputSeg> = {},
): MergeInputSeg {
  return { id, x1, y1, x2, y2, ...extra };
}

/** A horizontal segment on y = y from x = a to x = b. */
const H = (id: string, a: number, b: number, y = 0, extra = {}) =>
  S(id, a, y, b, y, extra);

const strip = (r: MergeResult): MergeInputSeg[] =>
  r.segs.map(({ sources: _s, sourceIndices: _i, ...rest }) => rest);

const coords = (s: { x1: number; y1: number; x2: number; y2: number }) => [
  s.x1,
  s.y1,
  s.x2,
  s.y2,
];

function distToLine(
  px: number,
  py: number,
  s: { x1: number; y1: number; x2: number; y2: number },
) {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  return Math.abs((px - s.x1) * dy - (py - s.y1) * dx) / Math.hypot(dx, dy);
}

/** Every original endpoint of every merged run lies within tol of the output line, and within the angle tolerance. */
function assertNoDrift(
  inputs: MergeInputSeg[],
  res: MergeResult,
  tol = TOL,
  angTol = ANG,
) {
  for (const out of res.segs) {
    if (out.sources.length < 2) continue;
    const oa = Math.atan2(out.y2 - out.y1, out.x2 - out.x1);
    for (const idx of out.sourceIndices) {
      const s = inputs[idx];
      expect(distToLine(s.x1, s.y1, out)).toBeLessThanOrEqual(tol + 1e-9);
      expect(distToLine(s.x2, s.y2, out)).toBeLessThanOrEqual(tol + 1e-9);
      const sa = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
      const d = Math.abs(Math.atan2(Math.sin(sa - oa), Math.cos(sa - oa)));
      expect(Math.min(d, Math.PI - d)).toBeLessThanOrEqual(angTol + 1e-9);
    }
  }
}

/** Deterministic PRNG so "random" tests are reproducible. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Canonical grouping: sorted list of sorted id lists. */
const grouping = (r: MergeResult) =>
  r.segs.map((s) => [...s.sources].sort().join("+")).sort();

/** Total length measure of the union of 1-D intervals. */
function unionMeasure(iv: [number, number][]) {
  const s = [...iv].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let curLo = -Infinity;
  let curHi = -Infinity;
  for (const [lo, hi] of s) {
    if (lo > curHi) {
      if (curHi > curLo) total += curHi - curLo;
      curLo = lo;
      curHi = hi;
    } else curHi = Math.max(curHi, hi);
  }
  if (curHi > curLo) total += curHi - curLo;
  return total;
}

// ---------------------------------------------------------------- basics

describe("mergeCollinear: basics", () => {
  it("returns an empty result for empty input", () => {
    expect(mergeCollinear([])).toEqual({
      segs: [],
      merges: [],
      refusals: [],
      skipped: [],
    });
  });

  it("returns a lone segment unchanged, with itself as its only source", () => {
    const r = mergeCollinear([
      S("a", 1, 2, 7, 9, { layer: "WALLS", thickness: 0.75, side: "left" }),
    ]);
    expect(r.segs).toEqual([
      {
        id: "a",
        x1: 1,
        y1: 2,
        x2: 7,
        y2: 9,
        layer: "WALLS",
        thickness: 0.75,
        side: "left",
        sources: ["a"],
        sourceIndices: [0],
      },
    ]);
    expect(r.merges).toEqual([]);
    expect(r.refusals).toEqual([]);
  });

  it("never mutates its input (frozen input does not throw, snapshot is identical)", () => {
    const input = [H("a", 0, 10), H("b", 6, 16), H("c", 0, 5, 3)].map((s) =>
      Object.freeze({ ...s }),
    ) as MergeInputSeg[];
    Object.freeze(input);
    const before = JSON.stringify(input);
    mergeCollinear(input, OPTS);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("is deterministic: the same input gives a deep-equal result", () => {
    const input = [
      H("a", 0, 10),
      H("b", 6, 16),
      H("c", 0, 5, 3),
      H("d", 4, 9, 0.02),
    ];
    expect(mergeCollinear(input, OPTS)).toEqual(mergeCollinear(input, OPTS));
  });

  it("exposes the documented (candidate) defaults", () => {
    expect(DEFAULT_MERGE_OPTIONS.offsetTol).toBe(0.05);
    expect(DEFAULT_MERGE_OPTIONS.angleTolRad).toBeCloseTo(
      0.5 * (Math.PI / 180),
      12,
    );
    expect(DEFAULT_MERGE_OPTIONS.minOverlap).toBe(0.1);
    expect(DEFAULT_MERGE_OPTIONS.faceOffsetMax).toBe(1.125);
    expect(DEFAULT_MERGE_OPTIONS.ambiguousAngleMaxRad).toBeCloseTo(
      5 * (Math.PI / 180),
      12,
    );
  });

  it("rejects invalid options", () => {
    expect(() => mergeCollinear([], { offsetTol: 0 })).toThrow(RangeError);
    expect(() => mergeCollinear([], { offsetTol: Number.NaN })).toThrow(
      RangeError,
    );
    expect(() => mergeCollinear([], { angleTolRad: -1 })).toThrow(RangeError);
    expect(() => mergeCollinear([], { minOverlap: -0.1 })).toThrow(RangeError);
    expect(() =>
      mergeCollinear([], { offsetTol: 0.1, faceOffsetMax: 0.05 }),
    ).toThrow(RangeError);
    expect(() =>
      mergeCollinear([], { angleTolRad: 0.1, ambiguousAngleMaxRad: 0.05 }),
    ).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------- overlaps

describe("mergeCollinear: complete and partial overlaps", () => {
  it("collapses an exact duplicate to one segment of the same length", () => {
    const r = mergeCollinear([H("a", 0, 10), H("b", 0, 10)], OPTS);
    expect(r.segs).toHaveLength(1);
    expect(coords(r.segs[0])).toEqual([0, 0, 10, 0]);
    expect(totalLength(r.segs)).toBe(10); // not 20
    expect(r.merges[0]).toMatchObject({
      inputLength: 20,
      outputLength: 10,
      removedLength: 10,
    });
  });

  it("collapses a reversed duplicate and keeps the FIRST contributor's direction", () => {
    const ab = mergeCollinear([H("a", 0, 10), H("b", 10, 0)], OPTS);
    expect(coords(ab.segs[0])).toEqual([0, 0, 10, 0]);
    expect(ab.segs[0].id).toBe("a");
    const ba = mergeCollinear([H("b", 10, 0), H("a", 0, 10)], OPTS);
    expect(coords(ba.segs[0])).toEqual([10, 0, 0, 0]);
    expect(ba.segs[0].id).toBe("b");
  });

  it("absorbs a fully contained segment and returns the container's exact coordinates", () => {
    const r = mergeCollinear([H("short", 3, 9), H("long", 0, 18)], OPTS);
    expect(r.segs).toHaveLength(1);
    expect(coords(r.segs[0])).toEqual([0, 0, 18, 0]);
    expect(r.segs[0].id).toBe("short"); // first contributor in input order
    expect(r.merges[0].removedLength).toBe(6);
  });

  it("merges a very short contained segment even though its overlap is below minOverlap", () => {
    const r = mergeCollinear([H("long", 0, 10), H("tiny", 4, 4.03)], OPTS);
    expect(r.segs).toHaveLength(1);
    expect(coords(r.segs[0])).toEqual([0, 0, 10, 0]);
  });

  it("returns the UNION length for a partial overlap, not the sum", () => {
    const r = mergeCollinear([H("a", 0, 10), H("b", 6, 16)], OPTS);
    expect(r.segs).toHaveLength(1);
    expect(coords(r.segs[0])).toEqual([0, 0, 16, 0]);
    expect(totalLength(r.segs)).toBe(16); // input sum is 20
    expect(r.merges[0]).toMatchObject({
      inputLength: 20,
      outputLength: 16,
      removedLength: 4,
    });
  });

  it("merges an overlap-connected chain A-B-C into one run even though A and C do not overlap", () => {
    const r = mergeCollinear(
      [H("a", 0, 10), H("b", 8, 18), H("c", 16, 26)],
      OPTS,
    );
    expect(r.segs).toHaveLength(1);
    expect(coords(r.segs[0])).toEqual([0, 0, 26, 0]);
    expect(r.segs[0].sources).toEqual(["a", "b", "c"]);
    expect(totalLength(r.segs)).toBe(26); // input sum is 30
  });

  it("reproduces the sample-house shared walls: a 12 ft edge inside an 18 ft edge", () => {
    const r = mergeCollinear(
      [S("wall-0-1", 20, 0, 20, 12), S("wall-1-3", 20, 18, 20, 0)],
      OPTS,
    );
    expect(r.segs).toHaveLength(1);
    expect(r.segs[0].id).toBe("wall-0-1");
    expect(coords(r.segs[0])).toEqual([20, 0, 20, 18]); // first contributor's direction (upwards)
    expect(r.merges[0]).toMatchObject({
      inputLength: 30,
      outputLength: 18,
      removedLength: 12,
    });
  });

  it("merges the same physical wall on the same line at 45 degrees", () => {
    const d = Math.SQRT1_2;
    const r = mergeCollinear(
      [S("a", 0, 0, 10 * d, 10 * d), S("b", 6 * d, 6 * d, 16 * d, 16 * d)],
      OPTS,
    );
    expect(r.segs).toHaveLength(1);
    expect(totalLength(r.segs)).toBeCloseTo(16, 9);
  });

  it("output length equals the independent geometric union for many random collinear intervals", () => {
    const rnd = mulberry32(12345);
    for (let trial = 0; trial < 25; trial++) {
      const iv: [number, number][] = [];
      const input: MergeInputSeg[] = [];
      for (let k = 0; k < 40; k++) {
        const a = Math.floor(rnd() * 200);
        const b = a + 1 + Math.floor(rnd() * 30);
        iv.push([a, b]);
        input.push(rnd() < 0.5 ? H(`s${k}`, a, b) : H(`s${k}`, b, a));
      }
      const r = mergeCollinear(input, { ...OPTS, minOverlap: 0 });
      expect(totalLength(r.segs)).toBeCloseTo(unionMeasure(iv), 9);
      // output pieces may touch but never overlap
      const out = r.segs
        .map((s) => [Math.min(s.x1, s.x2), Math.max(s.x1, s.x2)])
        .sort((p, q) => p[0] - q[0]);
      for (let k = 1; k < out.length; k++)
        expect(out[k][0]).toBeGreaterThanOrEqual(out[k - 1][1]);
    }
  });
});

// ---------------------------------------------------------------- adjacency / gaps / non-collinear

describe("mergeCollinear: things that must NOT merge", () => {
  it("leaves end-to-end adjacent segments alone, with no refusal", () => {
    const r = mergeCollinear([H("a", 0, 10), H("b", 10, 20)], OPTS);
    expect(r.segs).toHaveLength(2);
    expect(r.refusals).toEqual([]);
  });

  it("even with minOverlap = 0, segments that only touch end to end are never merged", () => {
    const r = mergeCollinear([H("a", 0, 10), H("b", 10, 20), H("c", 20, 30)], {
      ...OPTS,
      minOverlap: 0,
    });
    expect(r.segs).toHaveLength(3);
    expect(r.refusals).toEqual([]);
  });

  it("leaves segments separated by a gap alone", () => {
    const r = mergeCollinear([H("a", 0, 10), H("b", 10.5, 20)], OPTS);
    expect(r.segs).toHaveLength(2);
    expect(r.refusals).toEqual([]);
  });

  it("leaves T, L and X arrangements alone, with no refusal", () => {
    const r = mergeCollinear(
      [
        H("h", 0, 10),
        S("t", 5, 0, 5, 10), // T on the middle
        S("l", 10, 0, 10, 10), // L at the end
        S("x", 3, -5, 3, 5), // X crossing
      ],
      OPTS,
    );
    expect(r.segs).toHaveLength(4);
    expect(r.refusals).toEqual([]);
  });

  it("leaves parallel walls one foot apart alone, with no refusal when sides are unknown", () => {
    const r = mergeCollinear([H("a", 0, 10, 0), H("b", 0, 10, 1)], OPTS);
    expect(r.segs).toHaveLength(2);
    expect(r.refusals).toEqual([]);
  });

  it("does not merge a long wall with a slightly tilted one whose far end drifts beyond the offset tolerance", () => {
    // 0.3 degrees is inside the angle tolerance, but 30 ft * tan(0.3 deg) = 0.157 ft > 0.05 ft.
    const tilt = Math.tan((0.3 * Math.PI) / 180) * 30;
    const r = mergeCollinear([H("a", 0, 40), S("b", 0, 0, 30, tilt)], OPTS);
    expect(r.segs).toHaveLength(2);
    expect(r.refusals).toEqual([]);
  });
});

// ---------------------------------------------------------------- boundaries

describe("mergeCollinear: tolerance boundaries (offset, angle, overlap)", () => {
  const pairAtOffset = (d: number) => [H("lead", 0, 20, 0), H("c", 5, 15, d)];

  it("offset: exactly the tolerance merges, just below merges, just above does not", () => {
    expect(mergeCollinear(pairAtOffset(TOL), OPTS).segs).toHaveLength(1);
    expect(mergeCollinear(pairAtOffset(TOL - 1e-6), OPTS).segs).toHaveLength(1);
    expect(mergeCollinear(pairAtOffset(TOL + 1e-6), OPTS).segs).toHaveLength(2);
  });

  it("offset: the merged run lies on the longest member's line and the drift is reported", () => {
    const r = mergeCollinear(pairAtOffset(TOL), OPTS);
    expect(coords(r.segs[0])).toEqual([0, 0, 20, 0]);
    expect(r.merges[0].maxOffAxis).toBeCloseTo(TOL, 12);
  });

  it("offset: negative side behaves the same as positive", () => {
    expect(mergeCollinear(pairAtOffset(-TOL), OPTS).segs).toHaveLength(1);
    expect(mergeCollinear(pairAtOffset(-(TOL + 1e-6)), OPTS).segs).toHaveLength(
      2,
    );
  });

  const pairAtAngle = (a: number) => [
    H("lead", 0, 20),
    S("c", 2, 0, 2 + 4 * Math.cos(a), 4 * Math.sin(a)),
  ];

  it("angle: exactly the tolerance merges, just below merges, just above does not", () => {
    expect(mergeCollinear(pairAtAngle(ANG), OPTS).segs).toHaveLength(1);
    expect(mergeCollinear(pairAtAngle(ANG - 1e-6), OPTS).segs).toHaveLength(1);
    expect(mergeCollinear(pairAtAngle(ANG + 1e-6), OPTS).segs).toHaveLength(2);
    expect(mergeCollinear(pairAtAngle(-ANG), OPTS).segs).toHaveLength(1);
    expect(mergeCollinear(pairAtAngle(-(ANG + 1e-6)), OPTS).segs).toHaveLength(
      2,
    );
  });

  it("overlap: just above minOverlap merges, just below does not (and is not reported)", () => {
    const o = { ...OPTS, minOverlap: 0.1 };
    const mk = (b0: number) => [H("a", 0, 10), H("b", b0, 20)];
    expect(mergeCollinear(mk(9.9 - 1e-6), o).segs).toHaveLength(1); // overlap 0.100001
    const below = mergeCollinear(mk(9.9 + 1e-6), o); // overlap 0.099999
    expect(below.segs).toHaveLength(2);
    expect(below.refusals).toEqual([]);
  });
});

describe("mergeCollinear: no dependence on quantisation or position", () => {
  // The implementation uses no grid, but these sweeps would catch any grid/bucket
  // dependence: the pair is slid and rotated across thousands of positions, so
  // some pair is bound to straddle any internal boundary.

  it("angle just inside / just outside the tolerance decides identically at every orientation", () => {
    for (let k = 0; k < 400; k++) {
      const phi = (k / 400) * Math.PI;
      const ux = Math.cos(phi);
      const uy = Math.sin(phi);
      const ox = 3 + k * 0.731;
      const oy = -2 + k * 0.417;
      const pair = (delta: number) => [
        S("lead", ox, oy, ox + 20 * ux, oy + 20 * uy),
        S(
          "c",
          ox + 2 * ux,
          oy + 2 * uy,
          ox + 2 * ux + 4 * Math.cos(phi + delta),
          oy + 2 * uy + 4 * Math.sin(phi + delta),
        ),
      ];
      const sign = k % 2 === 0 ? 1 : -1;
      expect(mergeCollinear(pair(sign * (ANG - 1e-5)), OPTS).segs).toHaveLength(
        1,
      );
      expect(mergeCollinear(pair(sign * (ANG + 1e-5)), OPTS).segs).toHaveLength(
        2,
      );
    }
  });

  it("offset just inside / just outside the tolerance decides identically at every position", () => {
    for (let k = 0; k < 500; k++) {
      const phi = k * 0.0127;
      const ux = Math.cos(phi);
      const uy = Math.sin(phi);
      const nx = -uy;
      const ny = ux;
      const base = -3 + k * 0.0137; // slides the line across any grid
      const ox = base * nx;
      const oy = base * ny;
      const pair = (d: number) => [
        S("lead", ox, oy, ox + 20 * ux, oy + 20 * uy),
        S(
          "c",
          ox + 5 * ux + d * nx,
          oy + 5 * uy + d * ny,
          ox + 15 * ux + d * nx,
          oy + 15 * uy + d * ny,
        ),
      ];
      expect(mergeCollinear(pair(TOL - 1e-5), OPTS).segs).toHaveLength(1);
      expect(mergeCollinear(pair(TOL + 1e-5), OPTS).segs).toHaveLength(2);
      expect(mergeCollinear(pair(-(TOL - 1e-5)), OPTS).segs).toHaveLength(1);
      expect(mergeCollinear(pair(-(TOL + 1e-5)), OPTS).segs).toHaveLength(2);
    }
  });

  it("two segments in the same neighbourhood are not merged just for being near each other", () => {
    // 0.06 ft apart (just outside), identical angle, fully overlapping.
    const r = mergeCollinear([H("a", 0, 10, 0), H("b", 0, 10, 0.06)], OPTS);
    expect(r.segs).toHaveLength(2);
  });

  it("decisions are invariant under rotation + translation and under input shuffling", () => {
    const rnd = mulberry32(777);
    const scene: MergeInputSeg[] = [];
    const clusters = 14;
    for (let c = 0; c < clusters; c++) {
      const phi = rnd() * Math.PI;
      const ux = Math.cos(phi);
      const uy = Math.sin(phi);
      const cx = (c % 5) * 400;
      const cy = Math.floor(c / 5) * 400;
      // Three near members (offsets within 0.04 of each other, so any can be leader) and one far member.
      const specs: [number, number, number][] = [
        [0, 30.1 + c * 0.013, 0],
        [20, 55.3 + c * 0.017, 0.02],
        [45, 80.7 + c * 0.011, -0.02],
        [10, 70.9 + c * 0.019, 0.12], // clearly separate
      ];
      specs.forEach(([a, b, d], k) => {
        scene.push(
          S(
            `c${c}-${k}`,
            cx + a * ux - d * uy,
            cy + a * uy + d * ux,
            cx + b * ux - d * uy,
            cy + b * uy + d * ux,
          ),
        );
      });
    }
    const base = mergeCollinear(scene, OPTS);
    // each cluster: the 3 near members merge, the far one stays alone
    expect(base.segs).toHaveLength(clusters * 2);

    const cosA = Math.cos(0.37);
    const sinA = Math.sin(0.37);
    const moved = scene.map((s) =>
      S(
        s.id,
        s.x1 * cosA - s.y1 * sinA + 1234.5,
        s.x1 * sinA + s.y1 * cosA - 987.6,
        s.x2 * cosA - s.y2 * sinA + 1234.5,
        s.x2 * sinA + s.y2 * cosA - 987.6,
      ),
    );
    expect(grouping(mergeCollinear(moved, OPTS))).toEqual(grouping(base));

    const rnd2 = mulberry32(99);
    const shuffled = [...scene].sort(() => rnd2() - 0.5);
    const sh = mergeCollinear(shuffled, OPTS);
    expect(grouping(sh)).toEqual(grouping(base));
    expect(totalLength(sh.segs)).toBeCloseTo(totalLength(base.segs), 9);
  });
});

// ---------------------------------------------------------------- chain drift

describe("mergeCollinear: chain drift", () => {
  it("does not chain A(0) - B(0.04) - C(0.08): C is outside tolerance of the reference line", () => {
    const input = [H("A", 0, 30, 0), H("B", 5, 25, 0.04), H("C", 10, 20, 0.08)];
    const r = mergeCollinear(input, OPTS);
    expect(r.segs).toHaveLength(2);
    expect(r.segs[0].sources).toEqual(["A", "B"]);
    expect(coords(r.segs[0])).toEqual([0, 0, 30, 0]); // on the reference line, not B's
    expect(r.segs[1]).toMatchObject({
      id: "C",
      y1: 0.08,
      y2: 0.08,
      sources: ["C"],
    });
    expect(r.refusals).toEqual([
      expect.objectContaining({
        a: 1,
        b: 2,
        aId: "B",
        bId: "C",
        reason: "CHAIN_DRIFT",
      }),
    ]);
    assertNoDrift(input, r);
  });

  it("a 20-step staircase never builds a group wider than the tolerance and reports each break", () => {
    const input = Array.from({ length: 20 }, (_, k) =>
      H(`s${k}`, 0, 20, k * 0.04),
    );
    const r = mergeCollinear(input, OPTS);
    expect(r.segs).toHaveLength(10); // pairs (0,1) (2,3) ...
    for (const m of r.merges)
      expect(m.maxOffAxis).toBeLessThanOrEqual(TOL + 1e-9);
    assertNoDrift(input, r);
    expect(r.refusals).toHaveLength(9);
    expect(r.refusals.every((x) => x.reason === "CHAIN_DRIFT")).toBe(true);
  });
});

// ---------------------------------------------------------------- properties

describe("mergeCollinear: layer and thickness", () => {
  it("merges overlapping segments whose properties are all equal and keeps the properties", () => {
    const r = mergeCollinear(
      [
        H("a", 0, 10, 0, { layer: "WALLS", thickness: 0.75 }),
        H("b", 5, 15, 0, { layer: "WALLS", thickness: 0.75 }),
      ],
      OPTS,
    );
    expect(r.segs).toHaveLength(1);
    expect(r.segs[0]).toMatchObject({ layer: "WALLS", thickness: 0.75 });
  });

  it("merges when neither segment has a layer or thickness", () => {
    expect(
      mergeCollinear([H("a", 0, 10), H("b", 5, 15)], OPTS).segs,
    ).toHaveLength(1);
  });

  it("refuses a thickness mismatch (0.75 vs 0.375) and reports it", () => {
    const r = mergeCollinear(
      [
        H("a", 0, 10, 0, { thickness: 0.75 }),
        H("b", 5, 15, 0, { thickness: 0.375 }),
      ],
      OPTS,
    );
    expect(r.segs).toHaveLength(2);
    expect(r.refusals).toEqual([
      expect.objectContaining({ a: 0, b: 1, reason: "THICKNESS_MISMATCH" }),
    ]);
  });

  it("treats thickness equal within 1e-9 as equal", () => {
    const r = mergeCollinear(
      [
        H("a", 0, 10, 0, { thickness: 0.75 }),
        H("b", 5, 15, 0, { thickness: 0.75 + 1e-12 }),
      ],
      OPTS,
    );
    expect(r.segs).toHaveLength(1);
  });

  it("refuses a layer mismatch and reports it", () => {
    const r = mergeCollinear(
      [
        H("a", 0, 10, 0, { layer: "WALLS" }),
        H("b", 5, 15, 0, { layer: "PARTITION" }),
      ],
      OPTS,
    );
    expect(r.segs).toHaveLength(2);
    expect(r.refusals).toEqual([
      expect.objectContaining({ reason: "LAYER_MISMATCH" }),
    ]);
  });

  it("refuses when only one side has a layer / a thickness", () => {
    const a = mergeCollinear(
      [H("a", 0, 10, 0, { layer: "WALLS" }), H("b", 5, 15)],
      OPTS,
    );
    expect(a.segs).toHaveLength(2);
    expect(a.refusals[0].reason).toBe("LAYER_MISMATCH");
    const b = mergeCollinear(
      [H("a", 0, 10, 0, { thickness: 0.75 }), H("b", 5, 15)],
      OPTS,
    );
    expect(b.segs).toHaveLength(2);
    expect(b.refusals[0].reason).toBe("THICKNESS_MISMATCH");
  });

  it("merges the matching duplicates and refuses only the mismatching one", () => {
    const r = mergeCollinear(
      [
        H("a", 0, 10, 0, { thickness: 0.75 }),
        H("b", 0, 10, 0, { thickness: 0.75 }),
        H("c", 4, 14, 0, { thickness: 0.375 }),
      ],
      OPTS,
    );
    expect(r.segs.map((s) => s.sources)).toEqual([["a", "b"], ["c"]]);
    expect(r.refusals.map((x) => [x.a, x.b, x.reason])).toEqual([
      [0, 2, "THICKNESS_MISMATCH"],
      [1, 2, "THICKNESS_MISMATCH"],
    ]);
  });
});

// ---------------------------------------------------------------- sides (Q-A)

describe("mergeCollinear: interior side (same-side overlaps are refused)", () => {
  it("merges opposite-side overlaps (a shared partition) and drops the side on the merged run", () => {
    const r = mergeCollinear(
      [H("a", 0, 10, 0, { side: "left" }), H("b", 5, 15, 0, { side: "right" })],
      OPTS,
    );
    expect(r.segs).toHaveLength(1);
    expect(r.segs[0].side).toBeUndefined();
  });

  it("refuses same-side overlaps with SAME_SIDE_OVERLAP and keeps both", () => {
    const r = mergeCollinear(
      [H("a", 0, 10, 0, { side: "left" }), H("b", 5, 15, 0, { side: "left" })],
      OPTS,
    );
    expect(r.segs).toHaveLength(2);
    expect(r.segs[0].side).toBe("left");
    expect(r.refusals).toEqual([
      expect.objectContaining({ a: 0, b: 1, reason: "SAME_SIDE_OVERLAP" }),
    ]);
  });

  it("takes direction into account: a reversed segment's left is the other physical side", () => {
    // +x direction, left = +y. -x direction, "left" = -y, "right" = +y.
    const opposite = mergeCollinear(
      [H("a", 0, 10, 0, { side: "left" }), H("b", 15, 5, 0, { side: "left" })],
      OPTS,
    );
    expect(opposite.segs).toHaveLength(1);
    const same = mergeCollinear(
      [H("a", 0, 10, 0, { side: "left" }), H("b", 15, 5, 0, { side: "right" })],
      OPTS,
    );
    expect(same.segs).toHaveLength(2);
    expect(same.refusals[0].reason).toBe("SAME_SIDE_OVERLAP");
  });

  it("skips the side check when either segment has no side (Mode B style)", () => {
    expect(
      mergeCollinear([H("a", 0, 10, 0, { side: "left" }), H("b", 5, 15)], OPTS)
        .segs,
    ).toHaveLength(1);
    expect(
      mergeCollinear([H("a", 0, 10), H("b", 5, 15, 0, { side: "left" })], OPTS)
        .segs,
    ).toHaveLength(1);
  });

  it("dissolves the WHOLE group when any overlap in it is same-side (conservative), reporting each pair", () => {
    const r = mergeCollinear(
      [
        H("A", 0, 10, 0, { side: "left" }),
        H("B", 5, 15, 0, { side: "right" }), // opposite of A: would merge on its own
        H("C", 2, 12, 0, { side: "left" }), // same side as A
      ],
      OPTS,
    );
    expect(r.segs).toHaveLength(3);
    expect(r.merges).toEqual([]);
    expect(r.refusals.map((x) => [x.a, x.b, x.reason])).toEqual([
      [0, 1, "CONFLICT_IN_GROUP"],
      [0, 2, "SAME_SIDE_OVERLAP"],
      [1, 2, "CONFLICT_IN_GROUP"],
    ]);
  });
});

describe("mergeCollinear: face-offset pairs (rooms drawn at wall faces)", () => {
  const back = (gap: number) => [
    H("A", 0, 10, 0, { side: "right" }), // interior below
    H("B", 0, 10, gap, { side: "left" }), // interior above: back to back, wall in between
  ];

  it("refuses back-to-back opposite-side parallels 0.75 ft apart", () => {
    const r = mergeCollinear(back(0.75), OPTS);
    expect(r.segs).toHaveLength(2);
    expect(r.refusals).toEqual([
      expect.objectContaining({ reason: "FACE_OFFSET" }),
    ]);
    expect(r.refusals[0].detail).toContain("back to back");
  });

  it("refuses the facing variant too, and says so", () => {
    const r = mergeCollinear(
      [
        H("A", 0, 10, 0, { side: "left" }),
        H("B", 0, 10, 0.75, { side: "right" }),
      ],
      OPTS,
    );
    expect(r.segs).toHaveLength(2);
    expect(r.refusals[0].reason).toBe("FACE_OFFSET");
    expect(r.refusals[0].detail).toContain("facing");
  });

  it("merges them instead when they are within the offset tolerance", () => {
    expect(mergeCollinear(back(0.04), OPTS).segs).toHaveLength(1);
  });

  it("face-offset band is inclusive at faceOffsetMax and ends just beyond it", () => {
    const o = { ...OPTS, faceOffsetMax: 1.125 };
    expect(mergeCollinear(back(1.125), o).refusals).toHaveLength(1);
    expect(mergeCollinear(back(1.125 + 1e-6), o).refusals).toEqual([]);
    expect(mergeCollinear(back(2), o).refusals).toEqual([]);
  });

  it("does not report face-offset when sides are unknown (nothing to decide on)", () => {
    const r = mergeCollinear([H("A", 0, 10, 0), H("B", 0, 10, 0.75)], OPTS);
    expect(r.segs).toHaveLength(2);
    expect(r.refusals).toEqual([]);
  });

  it("does not report face-offset for same-side parallels or non-overlapping ones", () => {
    const same = mergeCollinear(
      [
        H("A", 0, 10, 0, { side: "left" }),
        H("B", 0, 10, 0.75, { side: "left" }),
      ],
      OPTS,
    );
    expect(same.refusals).toEqual([]);
    const apart = mergeCollinear(
      [
        H("A", 0, 10, 0, { side: "right" }),
        H("B", 12, 20, 0.75, { side: "left" }),
      ],
      OPTS,
    );
    expect(apart.refusals).toEqual([]);
  });
});

describe("mergeCollinear: ambiguous angles", () => {
  const tilted = (deg: number, y0 = 0, len = 4) => {
    const a = (deg * Math.PI) / 180;
    return [
      H("lead", 0, 20),
      S("c", 2, y0, 2 + len * Math.cos(a), y0 + len * Math.sin(a)),
    ];
  };

  it("reports an overlapping pair 2 degrees apart that touches the reference line", () => {
    const r = mergeCollinear(tilted(2), OPTS);
    expect(r.segs).toHaveLength(2);
    expect(r.refusals).toEqual([
      expect.objectContaining({ reason: "ANGLE_AMBIGUOUS" }),
    ]);
  });

  it("reports one that crosses the reference line within the overlap", () => {
    const r = mergeCollinear(tilted(2, -0.1, 6), OPTS);
    expect(r.refusals).toEqual([
      expect.objectContaining({ reason: "ANGLE_AMBIGUOUS" }),
    ]);
  });

  it("is silent when the lines are clearly apart (1 ft) or the angle is clearly different (10 degrees)", () => {
    expect(mergeCollinear(tilted(2, 1), OPTS).refusals).toEqual([]);
    expect(mergeCollinear(tilted(10), OPTS).refusals).toEqual([]);
  });

  it("band edges: just above the ambiguous maximum is silent, just below is reported", () => {
    const hi = (5 * Math.PI) / 180;
    const o = { ...OPTS, ambiguousAngleMaxRad: hi };
    const mk = (a: number) => [
      H("lead", 0, 20),
      S("c", 2, 0, 2 + 4 * Math.cos(a), 4 * Math.sin(a)),
    ];
    expect(mergeCollinear(mk(hi - 1e-6), o).refusals).toHaveLength(1);
    expect(mergeCollinear(mk(hi + 1e-6), o).refusals).toEqual([]);
  });
});

// ---------------------------------------------------------------- provenance

describe("mergeCollinear: provenance and deterministic contributor selection", () => {
  it("uses the first contributor in INPUT order for id, direction and properties, even when a later one is longer", () => {
    const r = mergeCollinear(
      [
        H("a", 2, 8, 0, { layer: "WALLS" }),
        H("b", 0, 10, 0, { layer: "WALLS" }),
      ],
      OPTS,
    );
    expect(r.segs[0]).toMatchObject({
      id: "a",
      layer: "WALLS",
      sources: ["a", "b"],
      sourceIndices: [0, 1],
    });
    expect(coords(r.segs[0])).toEqual([0, 0, 10, 0]); // a points +x
    const flipped = mergeCollinear([H("b", 10, 0), H("a", 2, 8)], OPTS);
    expect(flipped.segs[0].id).toBe("b");
    expect(coords(flipped.segs[0])).toEqual([10, 0, 0, 0]);
  });

  it("lists sources and sourceIndices in input order and records the merge", () => {
    const r = mergeCollinear(
      [H("x", 0, 5, 9), H("c", 8, 18), H("a", 0, 10)],
      OPTS,
    );
    expect(r.segs.map((s) => s.sources)).toEqual([["x"], ["c", "a"]]);
    expect(r.segs[1].sourceIndices).toEqual([1, 2]);
    expect(r.merges).toEqual([
      expect.objectContaining({
        id: "c",
        sources: ["c", "a"],
        sourceIndices: [1, 2],
      }),
    ]);
  });

  it("emits outputs in order of their first contributor, with un-merged segments in place", () => {
    const r = mergeCollinear(
      [H("p", 0, 10, 0), H("q", 0, 5, 7), H("r", 5, 15, 0), H("s", 0, 4, 20)],
      OPTS,
    );
    expect(r.segs.map((s) => s.id)).toEqual(["p", "q", "s"]);
  });

  it("is not affected by equal lengths: ties are resolved by coordinates, not by luck", () => {
    const a = mergeCollinear(
      [H("a", 0, 10), H("b", 5, 15), H("c", 10, 20)],
      OPTS,
    );
    const b = mergeCollinear(
      [H("c", 10, 20), H("b", 5, 15), H("a", 0, 10)],
      OPTS,
    );
    expect(a.segs).toHaveLength(1);
    expect(b.segs).toHaveLength(1);
    expect(totalLength(a.segs)).toBe(totalLength(b.segs));
    expect(b.segs[0].id).toBe("c"); // first in ITS input order
  });
});

// ---------------------------------------------------------------- degenerate input

describe("mergeCollinear: degenerate input", () => {
  it("passes zero-length and non-finite segments through unchanged, lists them as skipped, and still merges the rest", () => {
    const input = [
      S("zero", 3, 3, 3, 3),
      H("a", 0, 10),
      S("nan", Number.NaN, 0, 5, 0),
      H("b", 4, 14),
      S("inf", 0, 0, Number.POSITIVE_INFINITY, 0),
    ];
    const r = mergeCollinear(input, OPTS);
    expect(r.segs.map((s) => s.id)).toEqual(["zero", "a", "nan", "inf"]);
    expect(r.segs[1].sources).toEqual(["a", "b"]);
    expect(r.skipped.map((s) => [s.index, s.id, s.detail])).toEqual([
      [0, "zero", "zero-length segment"],
      [2, "nan", "non-finite coordinate"],
      [4, "inf", "non-finite coordinate"],
    ]);
  });
});

// ---------------------------------------------------------------- idempotency

describe("mergeCollinear: idempotency", () => {
  const again = (r: MergeResult, o = OPTS) => mergeCollinear(strip(r), o);

  const scenes: Record<string, MergeInputSeg[]> = {
    "overlaps and chains": [
      H("a", 0, 10),
      H("b", 8, 18),
      H("c", 16, 26),
      H("d", 0, 5, 3),
    ],
    "reversed + contained": [H("a", 0, 10), H("b", 10, 0), H("c", 3, 6)],
    "chain-drift refusal": [
      H("A", 0, 30, 0),
      H("B", 5, 25, 0.04),
      H("C", 10, 20, 0.08),
    ],
    "thickness refusal": [
      H("a", 0, 10, 0, { thickness: 0.75 }),
      H("b", 5, 15, 0, { thickness: 0.375 }),
    ],
    "same-side refusal": [
      H("a", 0, 10, 0, { side: "left" }),
      H("b", 5, 15, 0, { side: "left" }),
    ],
    staircase: Array.from({ length: 20 }, (_, k) =>
      H(`s${k}`, 0, 20, k * 0.04),
    ),
    "sample-house shared edges": [
      S("wall-0-1", 20, 0, 20, 12),
      S("wall-1-3", 20, 18, 20, 0),
      S("wall-1-1", 35, 0, 35, 18),
      S("wall-2-3", 35, 8, 35, 0),
    ],
  };

  for (const [name, scene] of Object.entries(scenes))
    it(`a second pass changes nothing: ${name}`, () => {
      const first = mergeCollinear(scene, OPTS);
      const second = again(first);
      expect(
        second.segs.map(({ sources: _a, sourceIndices: _b, ...s }) => s),
      ).toEqual(strip(first));
      expect(second.merges).toEqual([]);
    });

  it("a second pass changes nothing on a randomised scene with clearly separated cases", () => {
    const rnd = mulberry32(2024);
    const scene: MergeInputSeg[] = [];
    for (let c = 0; c < 30; c++) {
      const phi = rnd() * Math.PI;
      const ux = Math.cos(phi);
      const uy = Math.sin(phi);
      for (let k = 0; k < 5; k++) {
        const a = rnd() * 40;
        const b = a + 5 + rnd() * 30;
        const d = (rnd() < 0.5 ? 0 : 0.015) + (k === 4 ? 0.4 : 0); // k=4 clearly apart
        scene.push(
          S(
            `c${c}-${k}`,
            c * 300 + a * ux - d * uy,
            a * uy + d * ux,
            c * 300 + b * ux - d * uy,
            b * uy + d * ux,
          ),
        );
      }
    }
    const first = mergeCollinear(scene, OPTS);
    const second = again(first);
    expect(second.merges).toEqual([]);
    expect(second.segs).toHaveLength(first.segs.length);
    assertNoDrift(scene, first);
  });
});

// ---------------------------------------------------------------- real fixtures (read-only)

describe("mergeCollinear on fixture walls (Mode A input rebuilt from the room outlines)", () => {
  const dir = join(__dirname, "../fixtures");
  const parsed = (name: string) =>
    parseDxf(readFileSync(join(dir, name), "utf8")).geometry;
  // Stage 2 wires mergeCollinear into Mode A, so parsed Mode A walls are already
  // merged. These Stage 1 tests need the PRE-merge edges (one per polygon edge,
  // exactly what Mode A used to emit), so rebuild them from the room outlines.
  const preMerge = (g: ReturnType<typeof parsed>) => ({
    ...g,
    walls: g.rooms.flatMap((r, ri) =>
      r.shapes[0].flatMap((a, i, v) => {
        const b = v[(i + 1) % v.length];
        if (a.x === b.x && a.y === b.y) return [];
        return [
          {
            id: `wall-${ri}-${i}`,
            startX: a.x,
            startY: a.y,
            endX: b.x,
            endY: b.y,
            length: Math.hypot(b.x - a.x, b.y - a.y),
            height: 10,
            thickness: 0.75,
          },
        ];
      }),
    ),
  });
  const wallsOf = (name: string) =>
    name === "sample-house.dxf" ? preMerge(parsed(name)) : parsed(name);

  const toInput = (
    g: ReturnType<typeof wallsOf>,
    sideOf?: (id: string) => "left" | "right" | undefined,
  ): MergeInputSeg[] =>
    g.walls.map((w) =>
      S(w.id, w.startX, w.startY, w.endX, w.endY, {
        thickness: w.thickness,
        ...(sideOf?.(w.id) ? { side: sideOf(w.id) } : {}),
      }),
    );

  /** Interior side of Mode A wall `wall-{room}-{edge}` from its room polygon's winding. */
  const modeASide = (g: ReturnType<typeof wallsOf>) => (id: string) => {
    const r = Number(id.split("-")[1]);
    const v = g.rooms[r].shapes[0];
    let a2 = 0;
    for (let i = 0; i < v.length; i++) {
      const p = v[i];
      const q = v[(i + 1) % v.length];
      a2 += p.x * q.y - q.x * p.y;
    }
    return a2 > 0 ? ("left" as const) : ("right" as const);
  };

  it("sample-house.dxf (Mode A): the two shared edges merge; 12 walls / 158 ft become 10 walls / 138 ft", () => {
    const g = wallsOf("sample-house.dxf");
    expect(g.walls).toHaveLength(12);
    const input = toInput(g, modeASide(g));
    expect(totalLength(input)).toBe(158);

    const r = mergeCollinear(input, DEFAULT_MERGE_OPTIONS);
    expect(r.refusals).toEqual([]);
    expect(r.segs).toHaveLength(10);
    expect(totalLength(r.segs)).toBe(138);
    expect(r.merges.reduce((s, m) => s + m.removedLength, 0)).toBe(20);
    // wall-1-3 and wall-2-3 are absorbed; the survivors keep the first contributor's id and direction
    expect(r.segs.map((s) => s.id)).not.toContain("wall-1-3");
    expect(r.segs.map((s) => s.id)).not.toContain("wall-2-3");
    const w01 = r.segs.find((s) => s.id === "wall-0-1")!;
    expect(coords(w01)).toEqual([20, 0, 20, 18]);
    expect(w01.sources).toEqual(["wall-0-1", "wall-1-3"]);
    const w11 = r.segs.find((s) => s.id === "wall-1-1")!;
    expect(coords(w11)).toEqual([35, 0, 35, 18]);
    expect(w11.sources).toEqual(["wall-1-1", "wall-2-3"]);
    // gross wall face area at the 10 ft wall height: 1380 (was 1580)
    expect(totalLength(r.segs) * 10).toBe(1380);
    // every other wall is untouched, coordinates included
    const untouched = g.walls.filter(
      (w) => !["wall-0-1", "wall-1-3", "wall-1-1", "wall-2-3"].includes(w.id),
    );
    for (const w of untouched) {
      const o = r.segs.find((s) => s.id === w.id)!;
      expect(coords(o)).toEqual([w.startX, w.startY, w.endX, w.endY]);
      expect(o.sources).toEqual([w.id]);
    }
    assertNoDrift(
      input,
      r,
      DEFAULT_MERGE_OPTIONS.offsetTol,
      DEFAULT_MERGE_OPTIONS.angleTolRad,
    );
  });

  it("sample-house.dxf gives the same merge when sides are unknown (Mode B style)", () => {
    const g = wallsOf("sample-house.dxf");
    const r = mergeCollinear(toInput(g), DEFAULT_MERGE_OPTIONS);
    expect(r.segs).toHaveLength(10);
    expect(totalLength(r.segs)).toBe(138);
  });

  it("sample-house.dxf: if one shared edge is declared same-side it is refused, and only that pair is kept", () => {
    const g = wallsOf("sample-house.dxf");
    const base = modeASide(g);
    // wall-1-3 runs downwards; flipping its side makes it the same physical side as wall-0-1.
    const forced = (id: string) =>
      id === "wall-1-3"
        ? base(id) === "left"
          ? ("right" as const)
          : ("left" as const)
        : base(id);
    const r = mergeCollinear(toInput(g, forced), DEFAULT_MERGE_OPTIONS);
    expect(r.segs).toHaveLength(11);
    expect(r.refusals).toEqual([
      expect.objectContaining({
        aId: "wall-0-1",
        bId: "wall-1-3",
        reason: "SAME_SIDE_OVERLAP",
      }),
    ]);
  });

  it("sample-house.dxf is idempotent", () => {
    const g = wallsOf("sample-house.dxf");
    const first = mergeCollinear(
      toInput(g, modeASide(g)),
      DEFAULT_MERGE_OPTIONS,
    );
    const second = mergeCollinear(strip(first), DEFAULT_MERGE_OPTIONS);
    expect(second.merges).toEqual([]);
    expect(second.segs).toHaveLength(first.segs.length);
  });

  for (const name of [
    "whole_house_connected.dxf",
    "whole_house_simple_plan.dxf",
  ])
    it(`${name} (Mode B) has no overlaps: nothing merges, nothing is refused, coordinates are untouched`, () => {
      const g = wallsOf(name);
      const r = mergeCollinear(toInput(g), DEFAULT_MERGE_OPTIONS);
      expect(r.merges).toEqual([]);
      expect(r.refusals).toEqual([]);
      expect(r.skipped).toEqual([]);
      expect(r.segs).toHaveLength(g.walls.length);
      r.segs.forEach((s, i) => {
        const w = g.walls[i];
        expect(s.id).toBe(w.id);
        expect(coords(s)).toEqual([w.startX, w.startY, w.endX, w.endY]);
      });
    });
});

// ---------------------------------------------------------------- same-side regressions (Stage 1 review)

describe("mergeCollinear: same-side conflict regressions", () => {
  /** Same physical segment drawn the other way round: endpoints swapped, side label flipped. */
  const flip = (s: MergeInputSeg): MergeInputSeg => ({
    ...s,
    x1: s.x2,
    y1: s.y2,
    x2: s.x1,
    y2: s.y1,
    ...(s.side
      ? { side: s.side === "left" ? ("right" as const) : ("left" as const) }
      : {}),
  });

  const endpoints = (s: { x1: number; y1: number; x2: number; y2: number }) =>
    [
      [s.x1, s.y1],
      [s.x2, s.y2],
    ]
      .sort((p, q) => p[0] - q[0] || p[1] - q[1])
      .map((p) => p.map((n) => n.toFixed(9)).join(","))
      .join("|");
  const geometry = (r: MergeResult) => r.segs.map(endpoints).sort();
  const refusalKeys = (r: MergeResult) =>
    r.refusals
      .map((x) => `${[x.aId, x.bId].sort().join("~")}:${x.reason}`)
      .sort();
  const outcome = (r: MergeResult) => ({
    groups: grouping(r),
    geometry: geometry(r),
    refusals: refusalKeys(r),
  });

  // A tilted b whose endpoints are 0.048 and 0.035 ft off a's line. Lengths are made EXACTLY equal.
  const tilted = (side: "left" | "right" = "right") => {
    const ang = 0.001344;
    const b = S(
      "b",
      3.44608,
      -0.04819,
      3.44608 + 10 * Math.cos(ang),
      -0.04819 + 10 * Math.sin(ang),
      { side },
    );
    const len = Math.hypot(b.x2 - b.x1, b.y2 - b.y1);
    const a = S("a", 0, 0, len, 0, { side });
    return [a, b];
  };

  const scenes: Record<string, MergeInputSeg[]> = {
    "equal-length same-side overlap": [
      H("a", 0, 10, 0, { side: "right" }),
      H("b", 3, 13, 0, { side: "right" }),
    ],
    "equal-length same-side overlap, tilted (merged in one order before the fix)":
      tilted("right"),
    "right leader flanked by two overlapping left-side segments": [
      H("L", 0, 20, 0, { side: "right" }),
      H("m1", 2, 10, 0.04, { side: "left" }),
      H("m2", 4, 12, -0.04, { side: "left" }),
    ],
    "A/B/C with C same-side as A": [
      H("A", 0, 10, 0, { side: "left" }),
      H("B", 5, 15, 0, { side: "right" }),
      H("C", 2, 12, 0, { side: "left" }),
    ],
    "A/B/C/D with D overlapping only B": [
      H("A", 0, 10, 0, { side: "left" }),
      H("B", 5, 15, 0, { side: "right" }),
      H("C", 2, 12, 0, { side: "left" }),
      H("D", 14, 30, 0, { side: "left" }),
    ],
    "valid opposite-side pair": [
      H("A", 0, 10, 0, { side: "left" }),
      H("B", 5, 15, 0, { side: "right" }),
    ],
    "valid chain: same-side ends bridged by an opposite-side middle": [
      H("A", 0, 10, 0, { side: "left" }),
      H("B", 8, 20, 0, { side: "right" }),
      H("C", 18, 30, 0, { side: "left" }),
    ],
  };

  it("equal-length same-side overlap is refused in BOTH input orders (exact collinear)", () => {
    const s = scenes["equal-length same-side overlap"];
    for (const order of [s, [...s].reverse()]) {
      const r = mergeCollinear(order, OPTS);
      expect(r.segs).toHaveLength(2);
      expect(r.merges).toEqual([]);
      expect(refusalKeys(r)).toEqual(["a~b:SAME_SIDE_OVERLAP"]);
    }
  });

  it("equal-length tilted same-side overlap is refused in BOTH input orders (merged one way before the fix)", () => {
    const [a, b] = tilted("right");
    expect(Math.hypot(a.x2 - a.x1, a.y2 - a.y1)).toBe(
      Math.hypot(b.x2 - b.x1, b.y2 - b.y1),
    ); // true tie
    for (const order of [
      [a, b],
      [b, a],
    ]) {
      const r = mergeCollinear(order, OPTS);
      expect(r.segs).toHaveLength(2);
      expect(r.merges).toEqual([]);
      expect(refusalKeys(r)).toEqual(["a~b:SAME_SIDE_OVERLAP"]);
    }
  });

  it("equal-length opposite-side tilted pair merges in BOTH input orders", () => {
    const [a, b] = tilted("right");
    const bOpp = { ...b, side: "left" as const };
    for (const order of [
      [a, bOpp],
      [bOpp, a],
    ]) {
      const r = mergeCollinear(order, OPTS);
      expect(r.segs).toHaveLength(1);
      expect(r.refusals).toEqual([]);
    }
  });

  it("a long right-side leader with a left-side segment above AND one below: nothing merges, all pairs reported", () => {
    const r = mergeCollinear(
      scenes["right leader flanked by two overlapping left-side segments"],
      OPTS,
    );
    expect(r.segs).toHaveLength(3);
    expect(r.merges).toEqual([]);
    expect(refusalKeys(r)).toEqual([
      "L~m1:CONFLICT_IN_GROUP",
      "L~m2:CONFLICT_IN_GROUP",
      "m1~m2:SAME_SIDE_OVERLAP",
    ]);
    // untouched, coordinates included
    r.segs.forEach((s, i) => {
      const src =
        scenes["right leader flanked by two overlapping left-side segments"][i];
      expect(coords(s)).toEqual(coords(src));
      expect(s.sources).toEqual([src.id]);
    });
  });

  it("the same flanking scene is NOT refused when only one flank is present (a valid opposite-side pair merges)", () => {
    const r = mergeCollinear(
      [
        H("L", 0, 20, 0, { side: "right" }),
        H("m1", 2, 10, 0.04, { side: "left" }),
      ],
      OPTS,
    );
    expect(r.segs).toHaveLength(1);
    expect(r.refusals).toEqual([]);
    expect(r.segs[0].sources).toEqual(["L", "m1"]);
  });

  it("a valid opposite-side pair merges when no conflict exists", () => {
    const r = mergeCollinear(scenes["valid opposite-side pair"], OPTS);
    expect(r.segs).toHaveLength(1);
    expect(coords(r.segs[0])).toEqual([0, 0, 15, 0]);
    expect(r.refusals).toEqual([]);
  });

  it("same-side members that do NOT overlap each other may still merge through an opposite-side bridge", () => {
    const r = mergeCollinear(
      scenes["valid chain: same-side ends bridged by an opposite-side middle"],
      OPTS,
    );
    expect(r.segs).toHaveLength(1);
    expect(coords(r.segs[0])).toEqual([0, 0, 30, 0]);
    expect(r.refusals).toEqual([]);
  });

  it("a conflict group dissolves completely: every member is returned unchanged, no merge is recorded", () => {
    const scene = scenes["A/B/C/D with D overlapping only B"];
    const r = mergeCollinear(scene, OPTS);
    expect(r.segs).toHaveLength(4);
    expect(r.merges).toEqual([]);
    r.segs.forEach((s, i) => {
      expect(coords(s)).toEqual(coords(scene[i]));
      expect(s.sources).toEqual([scene[i].id]);
    });
    // D overlaps only B, but its group is dissolved with the rest
    expect(refusalKeys(r)).toEqual([
      "A~B:CONFLICT_IN_GROUP",
      "A~C:SAME_SIDE_OVERLAP",
      "B~C:CONFLICT_IN_GROUP",
      "B~D:CONFLICT_IN_GROUP",
    ]);
  });

  describe("reversed segment directions give the same grouping, geometry and refusals", () => {
    for (const [name, scene] of Object.entries(scenes)) {
      it(`${name}: all reversed, alternate ones reversed, and every one reversed individually`, () => {
        const base = outcome(mergeCollinear(scene, OPTS));
        expect(outcome(mergeCollinear(scene.map(flip), OPTS))).toEqual(base);
        expect(
          outcome(
            mergeCollinear(
              scene.map((s, i) => (i % 2 ? flip(s) : s)),
              OPTS,
            ),
          ),
        ).toEqual(base);
        scene.forEach((_, k) =>
          expect(
            outcome(
              mergeCollinear(
                scene.map((s, i) => (i === k ? flip(s) : s)),
                OPTS,
              ),
            ),
          ).toEqual(base),
        );
      });
    }
  });

  describe("shuffling keeps grouping, output geometry and refusals identical (only labels may change)", () => {
    it("on every named scene, in every rotation of the input order", () => {
      for (const [name, scene] of Object.entries(scenes)) {
        const base = outcome(mergeCollinear(scene, OPTS));
        for (let k = 1; k < scene.length; k++) {
          const rotated = [...scene.slice(k), ...scene.slice(0, k)];
          expect(outcome(mergeCollinear(rotated, OPTS)), name).toEqual(base);
        }
        expect(
          outcome(mergeCollinear([...scene].reverse(), OPTS)),
          name,
        ).toEqual(base);
      }
    });

    /** Scenes full of exact length ties, near-tolerance offsets and tilts, and sides. */
    const genScene = (rnd: () => number) =>
      Array.from({ length: 7 }, (_, k) => {
        const len = [10, 10, 10, 6][Math.floor(rnd() * 4)];
        const a = rnd() * 14;
        const y = (rnd() * 2 - 1) * 0.1;
        const ang = (rnd() * 2 - 1) * 0.7 * (Math.PI / 180);
        const side =
          rnd() < 0.65
            ? rnd() < 0.5
              ? ("left" as const)
              : ("right" as const)
            : undefined;
        const s = S(
          `s${k}`,
          a,
          y,
          a + len * Math.cos(ang),
          y + len * Math.sin(ang),
          side ? { side } : {},
        );
        return rnd() < 0.5 ? flip(s) : s;
      });

    it("on 4000 random tie-heavy scenes with sides, under 3 random shuffles each", () => {
      const rnd = mulberry32(20261115);
      for (let t = 0; t < 4000; t++) {
        const scene = genScene(rnd);
        const base = outcome(mergeCollinear(scene, OPTS));
        for (let k = 0; k < 3; k++) {
          const shuffled = [...scene].sort(() => rnd() - 0.5);
          expect(outcome(mergeCollinear(shuffled, OPTS))).toEqual(base);
        }
      }
    });

    it("the labels, and only the labels, follow input order (id and direction of the first contributor)", () => {
      const A = S("A", 0, 0, 10, 0);
      const Bflip = S("Bflip", 15, 0, 8, 0);
      const ab = mergeCollinear([A, Bflip], OPTS).segs[0];
      const ba = mergeCollinear([Bflip, A], OPTS).segs[0];
      expect([ab.id, ab.x1, ab.x2]).toEqual(["A", 0, 15]);
      expect([ba.id, ba.x1, ba.x2]).toEqual(["Bflip", 15, 0]);
      expect(endpoints(ab)).toBe(endpoints(ba));
    });

    it("no merged output ever contains two overlapping same-side members (independent oracle, 5000 scenes)", () => {
      const rnd = mulberry32(555);
      const minOverlap = OPTS.minOverlap;
      let merged = 0;
      for (let t = 0; t < 5000; t++) {
        const scene = genScene(rnd);
        const r = mergeCollinear(scene, OPTS);
        for (const out of r.segs) {
          if (out.sources.length < 2) continue;
          merged++;
          const ux =
            (out.x2 - out.x1) / Math.hypot(out.x2 - out.x1, out.y2 - out.y1);
          const uy =
            (out.y2 - out.y1) / Math.hypot(out.x2 - out.x1, out.y2 - out.y1);
          const info = out.sourceIndices.map((idx) => {
            const s = scene[idx];
            const t1 = (s.x1 - out.x1) * ux + (s.y1 - out.y1) * uy;
            const t2 = (s.x2 - out.x1) * ux + (s.y2 - out.y1) * uy;
            const dir = (s.x2 - s.x1) * ux + (s.y2 - s.y1) * uy >= 0 ? 1 : -1;
            const own = s.side === "left" ? 1 : s.side === "right" ? -1 : 0;
            return {
              lo: Math.min(t1, t2),
              hi: Math.max(t1, t2),
              side: own * dir,
            };
          });
          for (let p = 0; p < info.length; p++)
            for (let q = p + 1; q < info.length; q++) {
              if (info[p].side === 0 || info[p].side !== info[q].side) continue;
              const ov =
                Math.min(info[p].hi, info[q].hi) -
                Math.max(info[p].lo, info[q].lo);
              const shorter = Math.min(
                info[p].hi - info[p].lo,
                info[q].hi - info[q].lo,
              );
              const overlapping =
                ov > minOverlap || (ov > 0 && ov >= shorter - 1e-9);
              expect(overlapping, `scene ${t}`).toBe(false);
            }
        }
      }
      expect(merged).toBeGreaterThan(500); // the property was actually exercised
    });
  });
});
