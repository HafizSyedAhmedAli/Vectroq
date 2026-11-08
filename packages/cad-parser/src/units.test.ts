// Phase 1 unit tests. Real dxf-parser, real DXF text, numeric assertions on feet.
import { describe, it, expect } from "vitest";
import { unitNeedsConfirmation } from "@vectroq/shared-types";
import { parseDxf, parseDxfToGeometry, feetPerUnit } from "./parse-dxf";
import { resolveUnits, isPlausibleFootprint, drawingExtents } from "./units";

/** Closed rectangle on WALLS (an LWPOLYLINE), optionally with a $INSUNITS header. */
function rectDxf(w: number, h: number, opts: { insunits?: string; x0?: number; y0?: number } = {}) {
  const { x0 = 0, y0 = 0 } = opts;
  const pts = [
    [x0, y0],
    [x0 + w, y0],
    [x0 + w, y0 + h],
    [x0, y0 + h],
  ];
  const header =
    opts.insunits === undefined ? "" : `9\n$INSUNITS\n70\n${opts.insunits}\n`;
  return [
    "0\nSECTION\n2\nHEADER",
    header + "0\nENDSEC",
    "0\nSECTION\n2\nENTITIES",
    `0\nLWPOLYLINE\n8\nWALLS\n90\n4\n70\n1\n${pts.map(([x, y]) => `10\n${x}\n20\n${y}`).join("\n")}`,
    "0\nENDSEC\n0\nEOF\n",
  ].join("\n");
}

const sides = (text: string, confirmedUnit?: any) => {
  const { geometry, meta } = parseDxf(text, { confirmedUnit });
  return { lengths: geometry.walls.map((w) => w.length).sort((a, b) => a - b), meta };
};
const TOL = 1e-6;
/** 40 ft x 30 ft expressed as the 4 sides a rectangle should produce. */
const near = (got: number[], want: number[], tol = TOL) => {
  expect(got).toHaveLength(want.length);
  want.forEach((w, i) => expect(Math.abs(got[i] - w)).toBeLessThan(tol));
};

describe("explicit $INSUNITS (A-E)", () => {
  it.each([
    ["A feet", "2", 40, 30, 1, "foot"],
    ["B inches", "1", 480, 360, 1 / 12, "inch"],
    ["C millimetres", "4", 12192, 9144, 1 / 304.8, "millimetre"],
    ["D centimetres", "5", 1219.2, 914.4, 1 / 30.48, "centimetre"],
    ["E metres", "6", 12.192, 9.144, 3.280839895, "metre"],
  ])("%s -> a 40 x 30 ft box", (_n, code, w, h, k, unit) => {
    const { lengths, meta } = sides(rectDxf(w as number, h as number, { insunits: code as string }));
    near(lengths, [30, 30, 40, 40], 1e-5);
    expect(meta.unit.feetPerUnit).toBeCloseTo(k as number, 9);
    expect(meta.unit).toMatchObject({
      source: "header",
      unit,
      confidence: "high",
      confirmed: false,
      needsConfirmation: false,
    });
    expect(meta.warnings).toEqual([]);
    expect(unitNeedsConfirmation(meta)).toBe(false);
  });
});

describe("unitless drawings (F, G, I)", () => {
  it("F: a 12 x 10 metre plan is NOT read as feet; it is suggested as metres and needs confirmation", () => {
    const { lengths, meta } = sides(rectDxf(12, 10));
    // 12 m = 39.37 ft. The old code gave 12 ft.
    near(lengths, [10 * 3.28084, 10 * 3.28084, 12 * 3.28084, 12 * 3.28084], 1e-3);
    expect(Math.max(...lengths)).toBeGreaterThan(39);
    expect(meta.unit).toMatchObject({ unit: "metre", source: "plausibility", needsConfirmation: true, confirmed: false });
    expect(meta.unit.confidence).toBe("medium");
    expect(meta.warnings.map((w) => w.code)).toEqual(["UNIT_METADATA_MISSING", "UNIT_CONFIRMATION_REQUIRED"]);
    expect(unitNeedsConfirmation(meta)).toBe(true);
  });

  it("G: a 1200 x 1000 cm plan is NOT silently read as mm; cm and inch are both plausible", () => {
    const { lengths, meta } = sides(rectDxf(1200, 1000));
    // as mm it would be 3.9 ft; as cm 39.37 ft
    expect(Math.max(...lengths)).toBeGreaterThan(39);
    expect(meta.unit.feetPerUnit).toBeCloseTo(0.0328084, 7);
    expect(meta.unit.unit).toBe("centimetre");
    expect(meta.unit.feetPerUnit).not.toBeCloseTo(0.00328084, 6);
    const plausible = meta.unit.candidates!.filter((c) => c.plausible).map((c) => c.unit);
    expect(plausible).toEqual(expect.arrayContaining(["centimetre", "inch"]));
    expect(plausible).not.toContain("millimetre");
    expect(meta.unit.needsConfirmation).toBe(true);
    expect(meta.warnings.map((w) => w.code)).toContain("UNIT_AMBIGUOUS");
  });

  it("I: a 40 x 30 drawing is ambiguous (feet or metres): low confidence, confirmation required", () => {
    const { meta } = sides(rectDxf(40, 30));
    const plausible = meta.unit.candidates!.filter((c) => c.plausible).map((c) => c.unit);
    expect(plausible).toEqual(["foot", "metre"]);
    expect(meta.unit.confidence).toBe("low");
    expect(meta.unit.needsConfirmation).toBe(true);
    expect(meta.warnings.map((w) => w.code)).toEqual([
      "UNIT_METADATA_MISSING",
      "UNIT_AMBIGUOUS",
      "UNIT_CONFIRMATION_REQUIRED",
    ]);
    const ft = meta.unit.candidates!.find((c) => c.unit === "foot")!;
    const m = meta.unit.candidates!.find((c) => c.unit === "metre")!;
    expect(ft.widthFt).toBeCloseTo(40, 9);
    expect(m.widthFt).toBeCloseTo(40 * 3.280839895, 6);
  });

  it("12000 x 10000 (the unitless mm fixtures' size) has exactly one plausible unit: mm", () => {
    const { meta } = sides(rectDxf(12000, 10000));
    expect(meta.unit.candidates!.filter((c) => c.plausible).map((c) => c.unit)).toEqual(["millimetre"]);
    expect(meta.unit.needsConfirmation).toBe(true);
  });

  it("a drawing no unit can make building-sized is unknown, left as drawn, and needs confirmation", () => {
    const { lengths, meta } = sides(rectDxf(3, 3));
    near(lengths, [3, 3, 3, 3]);
    expect(meta.unit).toMatchObject({ unit: "unknown", source: "none", confidence: "unknown", feetPerUnit: 1, needsConfirmation: true });
  });

  it("a drawing with no geometry is unknown and needs confirmation", () => {
    const r = resolveUnits({ header: {}, entities: [] });
    expect(r.unit).toMatchObject({ unit: "unknown", needsConfirmation: true });
    expect(r.unit.extents).toBeUndefined();
  });
});

describe("offset drawings (H): detection uses width/height, never distance from origin", () => {
  it("explicit feet far from the origin converts exactly and raises nothing", () => {
    const { lengths, meta } = sides(rectDxf(40, 30, { insunits: "2", x0: 1_000_000, y0: 2_000_000 }));
    near(lengths, [30, 30, 40, 40]);
    expect(meta.unit).toMatchObject({ source: "header", unit: "foot", feetPerUnit: 1 });
    expect(meta.warnings).toEqual([]);
    expect(meta.unit.extents).toMatchObject({ width: 40, height: 30, minX: 1_000_000 });
  });

  it("U3 scenario: unitless 40 x 30 ft at x,y ~ 1000 is no longer read as mm", () => {
    const { lengths, meta } = sides(rectDxf(40, 30, { x0: 1000, y0: 1000 }));
    near(lengths, [30, 30, 40, 40]);
    expect(meta.unit.unit).toBe("foot");
    expect(meta.unit.feetPerUnit).toBe(1);
    expect(feetPerUnit(undefined, 1040)).toBe(0.00328084); // legacy wrapper unchanged
  });

  it.each([0, 1000, -5000, 123456.789, 1e7])("translating by %s changes nothing about the unit decision", (off) => {
    const base = resolveUnits({ entities: parseEntities(rectDxf(12, 10)) }).unit;
    const moved = resolveUnits({ entities: parseEntities(rectDxf(12, 10, { x0: off, y0: -off })) }).unit;
    expect(moved.unit).toBe(base.unit);
    expect(moved.confidence).toBe(base.confidence);
    expect(moved.feetPerUnit).toBe(base.feetPerUnit);
    expect(moved.candidates!.map((c) => c.plausible)).toEqual(base.candidates!.map((c) => c.plausible));
    moved.candidates!.forEach((c, i) => expect(c.widthFt).toBeCloseTo(base.candidates![i].widthFt, 6));
  });
});

function parseEntities(text: string) {
  return [
    {
      type: "LWPOLYLINE",
      vertices: text
        .split("LWPOLYLINE")[1]
        .split("\n")
        .reduce<number[]>((a, l, i, all) => (all[i - 1] === "10" || all[i - 1] === "20" ? [...a, Number(l)] : a), [])
        .reduce<{ x: number; y: number }[]>((v, n, i) => (i % 2 ? ((v[v.length - 1].y = n), v) : [...v, { x: n, y: 0 }]), []),
    },
  ];
}

describe("site plan vs building", () => {
  it("a far-off site boundary does not hide a plausible building (main body is evaluated too)", () => {
    const lines: any[] = [];
    // building 12000 x 10000 mm drawn as 40 short segments
    for (let i = 0; i < 40; i++)
      lines.push({ type: "LINE", vertices: [{ x: (i * 12000) / 40, y: i % 2 ? 0 : 10000 }, { x: ((i + 1) * 12000) / 40, y: i % 2 ? 0 : 10000 }] });
    lines.push({ type: "LINE", vertices: [{ x: -90000, y: -90000 }, { x: 200000, y: 150000 }] });
    const u = resolveUnits({ entities: lines }).unit;
    const mm = u.candidates!.find((c) => c.unit === "millimetre")!;
    expect(mm.plausible).toBe(true);
    expect(mm.reason).toMatch(/main body/);
    expect(u.needsConfirmation).toBe(true);
  });
});

describe("user confirmation and override (J, K)", () => {
  it("J: confirming the ambiguous 40 x 30 drawing as metres converts with exactly that unit", () => {
    const { lengths, meta } = sides(rectDxf(40, 30), "metre");
    near(lengths, [30 * 3.280839895, 30 * 3.280839895, 40 * 3.280839895, 40 * 3.280839895], 1e-6);
    expect(meta.unit).toMatchObject({ source: "user", confirmed: true, needsConfirmation: false, unit: "metre", confidence: "high", suggestedUnit: "foot" });
    expect(meta.unit.feetPerUnit).toBeCloseTo(3.280839895, 9);
    const codes = meta.warnings.map((w) => w.code);
    expect(codes).toContain("UNIT_USER_CONFIRMED");
    expect(codes).not.toContain("UNIT_CONFIRMATION_REQUIRED");
    expect(codes).not.toContain("UNIT_AMBIGUOUS");
    expect(unitNeedsConfirmation(meta)).toBe(false);
  });

  it("confirmation also accepts a $INSUNITS code", () => {
    const { lengths } = sides(rectDxf(480, 360), 1);
    near(lengths, [30, 30, 40, 40], 1e-6);
  });

  it("K: the user's unit beats the parser's suggestion and is recorded", () => {
    const { lengths, meta } = sides(rectDxf(40, 30), "inch"); // parser suggested foot
    near(lengths, [30 / 12, 30 / 12, 40 / 12, 40 / 12], 1e-9);
    expect(meta.unit).toMatchObject({ unit: "inch", source: "user", confirmed: true, suggestedUnit: "foot" });
    expect(meta.unit.feetPerUnit).toBeCloseTo(1 / 12, 12);
    expect(meta.warnings.find((w) => w.code === "UNIT_USER_CONFIRMED")!.message).toMatch(/differs from the suggested unit \(foot\)/);
  });

  it("K: the user may also override an explicit header, and the override is recorded", () => {
    const { lengths, meta } = sides(rectDxf(40, 30, { insunits: "2" }), "metre");
    near(lengths, [30 * 3.280839895, 30 * 3.280839895, 40 * 3.280839895, 40 * 3.280839895], 1e-6);
    expect(meta.unit).toMatchObject({ source: "user", unit: "metre", suggestedUnit: "foot" });
    expect(meta.warnings.find((w) => w.code === "UNIT_USER_CONFIRMED")!.message).toMatch(/overrides the drawing's own \$INSUNITS \(foot\)/);
  });

  it("an unsupported confirmed unit throws instead of guessing", () => {
    expect(() => parseDxf(rectDxf(40, 30), { confirmedUnit: "furlong" as any })).toThrow(/Unsupported drawing unit/);
    expect(() => parseDxf(rectDxf(40, 30), { confirmedUnit: 3 })).toThrow(/Unsupported drawing unit/);
  });

  it("the legacy wrapper has no confirmation path: it returns provisional geometry for unitless drawings", () => {
    const g = parseDxfToGeometry(rectDxf(12, 10));
    expect(Math.max(...g.walls.map((w) => w.length))).toBeGreaterThan(39);
  });
});

describe("invalid or unsupported $INSUNITS (L)", () => {
  it.each(["99", "3", "7", "-1", "abc"])("$INSUNITS=%s warns and is not used as a unit", (raw) => {
    const { meta } = sides(rectDxf(12, 10, { insunits: raw }));
    expect(meta.warnings[0]).toMatchObject({ code: "UNIT_METADATA_INVALID", severity: "warning" });
    expect(meta.warnings[0].message).toContain(raw === "abc" ? "NaN" : raw);
    expect(meta.unit.source).toBe("plausibility");
    expect(meta.unit.needsConfirmation).toBe(true);
    expect(meta.warnings.map((w) => w.code)).toContain("UNIT_CONFIRMATION_REQUIRED");
    expect(meta.unit.unit).toBe("metre"); // from the extents suggestion, never from the bad code
  });

  it("a user can resolve an invalid header; the invalid-metadata note is kept as info", () => {
    const { lengths, meta } = sides(rectDxf(12, 10, { insunits: "99" }), "metre");
    near(lengths, [10 * 3.280839895, 10 * 3.280839895, 12 * 3.280839895, 12 * 3.280839895], 1e-6);
    expect(meta.warnings.find((w) => w.code === "UNIT_METADATA_INVALID")!.severity).toBe("info");
    expect(meta.unit.confirmed).toBe(true);
  });

  it("an implausible explicit header is used as declared but warned about", () => {
    const { lengths, meta } = sides(rectDxf(5, 5, { insunits: "2" }));
    near(lengths, [5, 5, 5, 5]);
    expect(meta.unit).toMatchObject({ source: "header", confidence: "medium", needsConfirmation: false });
    expect(meta.warnings.map((w) => w.code)).toEqual(["UNIT_HEADER_IMPLAUSIBLE"]);
  });
});

describe("helpers", () => {
  it("drawingExtents ignores text and dimensions and is translation invariant", () => {
    const e = drawingExtents([
      { type: "LINE", vertices: [{ x: 5, y: 5 }, { x: 15, y: 25 }] },
      { type: "TEXT", startPoint: { x: 9999, y: 9999 } },
      { type: "CIRCLE", center: { x: 10, y: 10 }, radius: 1 },
    ])!;
    expect(e).toMatchObject({ minX: 5, minY: 5, maxX: 15, maxY: 25, width: 10, height: 20 });
  });
  it("isPlausibleFootprint boundaries", () => {
    expect(isPlausibleFootprint(40, 30)).toBe(true);
    expect(isPlausibleFootprint(40, 7)).toBe(false); // too narrow
    expect(isPlausibleFootprint(500, 100)).toBe(false); // too long
    expect(isPlausibleFootprint(10, 10)).toBe(false); // too small
  });
});
