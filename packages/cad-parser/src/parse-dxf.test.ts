import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({ result: null as any }));

vi.mock("dxf-parser", () => ({
  default: class {
    parseSync() {
      return state.result;
    }
  },
}));
vi.mock("./dxf-to-geometry", () => ({
  dxfToGeometry: vi.fn((input: unknown) => ({ walls: [], rooms: [], openings: [], input })),
}));

import { feetPerUnit, parseDxfToGeometry } from "./parse-dxf";
import { dxfToGeometry } from "./dxf-to-geometry";

const entitiesPassed = () =>
  (vi.mocked(dxfToGeometry).mock.calls.at(-1)![0] as any).entities as any[];

beforeEach(() => vi.mocked(dxfToGeometry).mockClear());

describe("feetPerUnit", () => {
  it.each([
    [1, 1 / 12],
    [2, 1],
    [4, 0.00328084],
    [5, 0.0328084],
    [6, 3.28084],
  ])("INSUNITS %i", (code, expected) => {
    expect(feetPerUnit(code, 10)).toBeCloseTo(expected);
  });
  it("guesses millimetres for big unitless drawings, feet otherwise", () => {
    expect(feetPerUnit(undefined, 501)).toBe(0.00328084);
    expect(feetPerUnit(0, 500)).toBe(1);
    expect(feetPerUnit("4", 10)).toBe(1);
    expect(feetPerUnit(99, 100)).toBe(1);
  });
  it("header wins over extent", () => {
    expect(feetPerUnit(2, 100000)).toBe(1);
  });
});

describe("parseDxfToGeometry", () => {
  it("throws when the parser returns nothing", () => {
    state.result = null;
    expect(() => parseDxfToGeometry("x")).toThrow(/malformed or empty/);
  });

  it("handles a drawing with no entities", () => {
    state.result = { header: {} };
    parseDxfToGeometry("x");
    expect(entitiesPassed()).toEqual([]);
  });

  it("scales vertices, start points, centres and radii by the header unit", () => {
    state.result = {
      header: { $INSUNITS: 2 },
      entities: [
        {
          type: "LWPOLYLINE",
          vertices: [
            { x: 1, y: 2 },
            { x: 3, y: 4 },
          ],
        },
        { type: "CIRCLE", center: { x: 5, y: 6 }, radius: 2 },
      ],
    };
    parseDxfToGeometry("x");
    const [poly, circle] = entitiesPassed();
    expect(poly.vertices[1]).toMatchObject({ x: 3, y: 4 });
    expect(circle.center).toMatchObject({ x: 5, y: 6 });
    expect(circle.radius).toBe(2);
  });

  it("converts millimetre drawings with no header to feet", () => {
    state.result = {
      header: {},
      entities: [
        {
          type: "LINE",
          vertices: [
            { x: 0, y: 0 },
            { x: -6000, y: 3000 },
          ],
        },
      ],
    };
    parseDxfToGeometry("x");
    const v = entitiesPassed()[0].vertices;
    expect(v[1].x).toBeCloseTo(-6000 * 0.00328084);
    expect(v[1].y).toBeCloseTo(3000 * 0.00328084);
  });

  it("treats MTEXT like TEXT, anchored at its position, with \\P as a space", () => {
    state.result = {
      header: { $INSUNITS: 6 },
      entities: [
        { type: "MTEXT", position: { x: 1, y: 2 }, text: "Master\\PBed" },
        { type: "MTEXT", position: { x: 0, y: 0 } },
      ],
    };
    parseDxfToGeometry("x");
    const [a, b] = entitiesPassed();
    expect(a.type).toBe("TEXT");
    expect(a.text).toBe("Master Bed");
    expect(a.startPoint.x).toBeCloseTo(3.28084);
    expect(a.startPoint.y).toBeCloseTo(2 * 3.28084);
    expect(b.text).toBe("");
  });

  it("passes the construction defaults through", () => {
    state.result = { header: {}, entities: [] };
    const c = { wallHeightFt: 9 } as any;
    parseDxfToGeometry("x", c);
    expect(vi.mocked(dxfToGeometry).mock.calls.at(-1)![1]).toBe(c);
  });
});
