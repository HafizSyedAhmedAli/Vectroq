// Phase 2, Stage 3b corrections: the normalization stage itself.
import { describe, expect, it } from "vitest";
import { normalizeOrientation } from "./normalize-orientation";
import {
  ROTATION_EPS,
  detectOrientation,
  isAlignedAngle,
  type Seg,
} from "./orientation";
import { ParseReport, PARSER_VERSION } from "./report";
import { parseDxf } from "./parse-dxf";

const D = Math.PI / 180;
type P = [number, number];
const rot = ([x, y]: P, a: number): P => [
  x * Math.cos(a) - y * Math.sin(a),
  x * Math.sin(a) + y * Math.cos(a),
];
const RECT: P[] = [
  [0, 0],
  [30, 0],
  [30, 20],
  [0, 20],
];
const line = (a: P, b: P, layer = "WALLS") => ({
  type: "LINE",
  layer,
  vertices: [
    { x: a[0], y: a[1], z: 0 },
    { x: b[0], y: b[1], z: 0 },
  ],
});
const plan = (angle: number) =>
  RECT.map((p, i) => line(rot(p, angle), rot(RECT[(i + 1) % 4], angle))).concat(
    [line(rot([5, 0], angle), rot([9, 0], angle), "WINDOWS")],
  );
const deepFreeze = <T>(o: T): T => {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o as object).forEach(deepFreeze);
  }
  return o;
};

describe("normalizeOrientation", () => {
  it("frozen input entities are never mutated (rotation applied)", () => {
    const ents = deepFreeze(plan(25 * D));
    const before = JSON.stringify(ents);
    const r = normalizeOrientation(ents as any[]);
    expect(r.rotationRad).toBeCloseTo(-25 * D, 9);
    expect(JSON.stringify(ents)).toBe(before);
    expect(r.entities).not.toBe(ents);
    // every returned entity is a new object, so later stages cannot alias the input
    r.entities.forEach((e, i) => expect(e).not.toBe(ents[i]));
  });

  it("frozen input is not mutated when nothing is applied either", () => {
    const ents = deepFreeze(plan(0));
    const before = JSON.stringify(ents);
    const r = normalizeOrientation(ents as any[]);
    expect(r.rotationRad).toBe(0);
    expect(JSON.stringify(ents)).toBe(before);
  });

  it("is idempotent: a second pass applies nothing and returns the same entities", () => {
    for (const deg of [25, -31, 44, -44, 0.01, 45, -45]) {
      const first = normalizeOrientation(plan(deg * D) as any[]);
      const second = normalizeOrientation(first.entities);
      expect(second.rotationRad).toBe(0);
      expect(Object.is(second.rotationRad, -0)).toBe(false);
      expect(second.entities).toBe(first.entities);
    }
  });

  it("applying the reported rotation to the drawing makes the walls axis-aligned", () => {
    for (const deg of [25, -31, 44, -44, 13.37]) {
      const r = normalizeOrientation(plan(deg * D) as any[]);
      for (const e of r.entities.filter(
        (x: any) => x.layer === "WALLS",
      ) as any[]) {
        const [a, b] = e.vertices;
        expect(Math.min(Math.abs(b.x - a.x), Math.abs(b.y - a.y))).toBeLessThan(
          1e-9,
        );
      }
    }
  });

  it("reports PLAN_ROTATED (info) when it rotates and ROTATION_UNCERTAIN (warning) when it refuses a rotated-looking plan", () => {
    const rep = new ParseReport();
    normalizeOrientation(plan(20 * D) as any[], rep);
    expect(
      rep.toMeta({} as any).warnings.map((w) => [w.code, w.severity]),
    ).toEqual([["PLAN_ROTATED", "info"]]);
    const rep2 = new ParseReport();
    const parallel = [0, 5, 10, 15].map((y) =>
      line(rot([0, y], 20 * D), rot([30, y], 20 * D)),
    );
    normalizeOrientation(parallel as any[], rep2);
    expect(
      rep2.toMeta({} as any).warnings.map((w) => [w.code, w.severity]),
    ).toEqual([["ROTATION_UNCERTAIN", "warning"]]);
  });
});

describe("aligned-angle threshold (1e-6 rad)", () => {
  it("the threshold constant is 1e-6", () => {
    expect(ROTATION_EPS).toBe(1e-6);
  });

  const next = (x: number) => x + Math.abs(x) * Number.EPSILON; // the next double up for positive x
  it("isAlignedAngle: below, exactly at and immediately above the threshold", () => {
    expect(isAlignedAngle(1e-6 * (1 - 1e-9))).toBe(true);
    expect(isAlignedAngle(1e-6)).toBe(true);
    expect(isAlignedAngle(-1e-6)).toBe(true);
    expect(isAlignedAngle(next(1e-6))).toBe(false);
    expect(isAlignedAngle(-next(1e-6))).toBe(false);
    expect(isAlignedAngle(0)).toBe(true);
    expect(isAlignedAngle(-0)).toBe(true);
    expect(isAlignedAngle(1e-9)).toBe(true); // the old threshold is now well inside
    expect(isAlignedAngle(1.7e-4)).toBe(false); // 0.01 degrees
  });

  const skewed = (rad: number): Seg[] =>
    RECT.map((p, i) => {
      const [x1, y1] = rot(p, rad);
      const [x2, y2] = rot(RECT[(i + 1) % 4], rad);
      return { x1, y1, x2, y2 };
    });

  it("a plan skewed by less than 1e-6 rad is left alone: rotationRad is +0 and the entities are returned untouched", () => {
    for (const rad of [0, 1e-12, 1e-9, 1e-8, 5e-7, 9.9e-7, -9.9e-7, -5e-7]) {
      const r = detectOrientation(skewed(rad));
      expect(r.status).toBe("aligned");
      expect(r.rotationRad).toBe(0);
      expect(Object.is(r.rotationRad, -0)).toBe(false);
      const ents = plan(rad);
      const n = normalizeOrientation(ents as any[]);
      expect(n.rotationRad).toBe(0);
      expect(n.entities).toBe(ents);
    }
  });

  it("a plan skewed by more than 1e-6 rad is rotated, normalised to the canonical interval", () => {
    for (const rad of [1.01e-6, 2e-6, -1.01e-6, 1e-5, 1.7e-4, -1.7e-4]) {
      const r = detectOrientation(skewed(rad));
      expect(r.status).toBe("rotate");
      expect(r.detectedRad).toBeCloseTo(rad, 12);
      expect(r.rotationRad).toBeCloseTo(-rad, 12);
      expect(r.detectedRad).toBeGreaterThan(-Math.PI / 4);
      expect(r.detectedRad).toBeLessThanOrEqual(Math.PI / 4);
    }
  });

  it("0.01 degrees and larger still rotate; the 45 degree boundary is unchanged", () => {
    for (const deg of [0.01, 0.1, 1, 15, 30, 44, -0.01, -1, -44]) {
      const r = detectOrientation(skewed(deg * D));
      expect(r.status).toBe("rotate");
      expect(r.detectedRad).toBeCloseTo(deg * D, 9);
    }
    for (const deg of [45, -45]) {
      const r = detectOrientation(skewed(deg * D));
      expect(r.detectedRad).toBeGreaterThan(-Math.PI / 4);
      expect(r.detectedRad).toBeLessThanOrEqual(Math.PI / 4);
    }
  });
});

describe("parser version", () => {
  it("is 0.2.0-stage3b and is exposed through ParseMeta", () => {
    expect(PARSER_VERSION).toBe("0.2.0-stage3b");
    const dxf = [
      "0",
      "SECTION",
      "2",
      "HEADER",
      "9",
      "$INSUNITS",
      "70",
      "2",
      "0",
      "ENDSEC",
      "0",
      "SECTION",
      "2",
      "ENTITIES",
      "0",
      "ENDSEC",
      "0",
      "EOF",
    ].join("\n");
    expect(parseDxf(dxf).meta.parserVersion).toBe("0.2.0-stage3b");
  });
});
