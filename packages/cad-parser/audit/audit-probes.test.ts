// packages/cad-parser/audit/audit-probes.test.ts
// AUDIT ONLY. Characterisation probes: they assert what the parser does TODAY.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { dxfToGeometry, type RawEntity } from "../src/dxf-to-geometry";
import { feetPerUnit, parseDxfToGeometry } from "../src/parse-dxf";

const L = (layer: string, x1: number, y1: number, x2: number, y2: number) =>
  ({
    type: "LINE",
    layer,
    vertices: [
      { x: x1, y: y1 },
      { x: x2, y: y2 },
    ],
  }) as RawEntity;
const P = (layer: string, pts: [number, number][]) =>
  ({
    type: "LWPOLYLINE",
    layer,
    vertices: pts.map(([x, y]) => ({ x, y })),
  }) as RawEntity;
const T = (x: number, y: number, text: string, layer = "TEXT") =>
  ({ type: "TEXT", layer, startPoint: { x, y }, text }) as RawEntity;
const rect = (
  layer: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) => [
  L(layer, x0, y0, x1, y0),
  L(layer, x1, y0, x1, y1),
  L(layer, x1, y1, x0, y1),
  L(layer, x0, y1, x0, y0),
];
const g = (entities: RawEntity[]) => dxfToGeometry({ entities });
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("fixture summary (prints what the parser actually reads)", () => {
  it("parses all three fixtures", () => {
    for (const f of [
      "sample-house.dxf",
      "whole_house_simple_plan.dxf",
      "whole_house_connected.dxf",
    ]) {
      const geo = parseDxfToGeometry(
        readFileSync(join(__dirname, "../fixtures", f), "utf8"),
      );
      console.log(
        f,
        JSON.stringify({
          rooms: geo.rooms.map((r) => [r.name, r.type, +r.area.toFixed(2)]),
          walls: geo.walls.length,
          totalWallFt: +sum(geo.walls.map((w) => w.length)).toFixed(2),
          doors: geo.openings
            .filter((o) => o.type === "door")
            .map((o) => +o.width.toFixed(2)),
          windows: geo.openings
            .filter((o) => o.type === "window")
            .map((o) => +o.width.toFixed(2)),
        }),
      );
      expect(geo).toBeDefined();
    }
  });
});

describe("units", () => {
  it("U1 unitless metre drawing is read as feet (3.28x too small)", () => {
    expect(feetPerUnit(0, 12)).toBe(1);
  });
  it("U2 unitless cm drawing is read as mm (10x too small)", () => {
    expect(feetPerUnit(undefined, 1200)).toBe(0.00328084);
  });
  it("U3 a feet drawing offset from the origin is read as mm (extent uses absolute coords)", () => {
    expect(feetPerUnit(undefined, 1040)).toBe(0.00328084);
  });
});

describe("polyline mode", () => {
  it("P1 a 2-vertex wall polyline becomes a zero-area room and 2 walls", () => {
    const r = g([
      P("WALLS", [
        [0, 0],
        [10, 0],
      ]),
    ]);
    expect(r.rooms).toHaveLength(1);
    expect(r.rooms[0].area).toBe(0);
    expect(r.walls).toHaveLength(2);
  });
  it("P2 an OPEN polyline is silently closed into a room", () => {
    const r = g([
      P("WALLS", [
        [0, 0],
        [10, 0],
        [10, 5],
        [0, 5],
      ]),
    ]);
    expect(r.rooms[0].area).toBe(50);
    expect(r.walls).toHaveLength(4);
  });
  it("P3 shared walls are counted once per room (sample-house geometry)", () => {
    const r = g([
      P("WALLS", [
        [0, 0],
        [20, 0],
        [20, 12],
        [0, 12],
        [0, 0],
      ]),
      P("WALLS", [
        [20, 0],
        [35, 0],
        [35, 18],
        [20, 18],
        [20, 0],
      ]),
      P("WALLS", [
        [35, 0],
        [41, 0],
        [41, 8],
        [35, 8],
        [35, 0],
      ]),
    ]);
    expect(sum(r.walls.map((w) => w.length))).toBeCloseTo(158); // unique run = 138
  });
  it("P4 one WALLS polyline makes every WALLS line vanish", () => {
    const r = g([
      P("WALLS", [
        [0, 0],
        [20, 0],
        [20, 12],
        [0, 12],
        [0, 0],
      ]),
      L("WALLS", 10, 0, 10, 12),
    ]);
    expect(r.walls).toHaveLength(4);
  });
  it("P5 every polyline wall gets exterior thickness, even partitions", () => {
    const r = g([
      P("WALLS", [
        [0, 0],
        [10, 0],
        [10, 5],
        [0, 5],
        [0, 0],
      ]),
    ]);
    expect(r.walls.every((w) => w.thickness === 0.75)).toBe(true);
  });
  it("P6 WC is 'general' here but 'bathroom' in line mode", () => {
    const poly = g([
      P("WALLS", [
        [0, 0],
        [6, 0],
        [6, 8],
        [0, 8],
        [0, 0],
      ]),
      T(3, 4, "WC"),
    ]);
    const line = g([...rect("WALLS", 0, 0, 6, 8), T(3, 4, "WC")]);
    expect(poly.rooms[0].type).toBe("general");
    expect(line.rooms[0].type).toBe("bathroom");
  });
});

describe("line mode", () => {
  it("L1 a door gap in an exterior wall makes ALL rooms disappear", () => {
    const r = g([
      L("WALLS", 0, 0, 8, 0),
      L("WALLS", 12, 0, 20, 0),
      L("WALLS", 20, 0, 20, 12),
      L("WALLS", 20, 12, 0, 12),
      L("WALLS", 0, 12, 0, 0),
      T(10, 6, "LIVING"),
    ]);
    expect(r.rooms).toHaveLength(0);
    expect(r.walls.length).toBeGreaterThan(0);
  });
  it("L2 a 0.02 ft (6 mm) corner gap does the same", () => {
    const r = g([
      L("WALLS", 0, 0, 20, 0),
      L("WALLS", 20, 0, 20, 11.98),
      L("WALLS", 20, 12, 0, 12),
      L("WALLS", 0, 12, 0, 0),
    ]);
    expect(r.rooms).toHaveLength(0);
  });
  it("L3 double-line walls create a phantom wall-cavity room; area = full footprint", () => {
    const r = g([
      ...rect("WALLS", 0, 0, 20, 12),
      ...rect("WALLS", 0.75, 0.75, 19.25, 11.25),
    ]);
    expect(r.rooms).toHaveLength(2);
    expect(sum(r.rooms.map((x) => x.area))).toBeCloseTo(240);
  });
  it("L4 a plot boundary becomes a room and steals the exterior-wall thickness", () => {
    const r = g([
      ...rect("WALLS", 0, 0, 40, 32),
      ...rect("WALLS", 10, 10, 30, 22),
      T(20, 16, "LIVING"),
    ]);
    expect(r.rooms).toHaveLength(2);
    expect(r.walls.filter((w) => w.thickness === 0.375)).toHaveLength(4); // the house walls
  });
  it("L5 a rotated plan yields no rooms", () => {
    const c = Math.cos(0.5),
      s = Math.sin(0.5);
    const p = (
      [
        [0, 0],
        [20, 0],
        [20, 12],
        [0, 12],
      ] as [number, number][]
    ).map(([x, y]) => [x * c - y * s, x * s + y * c]);
    const r = g(
      p.map((a, i) =>
        L("WALLS", a[0], a[1], p[(i + 1) % 4][0], p[(i + 1) % 4][1]),
      ),
    );
    expect(r.rooms).toHaveLength(0);
    expect(r.walls).toHaveLength(4);
  });
});

describe("openings", () => {
  const walls = P("WALLS", [
    [0, 0],
    [20, 0],
    [20, 12],
    [0, 12],
    [0, 0],
  ]);
  it("O1 three parallel lines for one window = three windows", () => {
    const r = g([
      walls,
      L("WINDOW", 5, 0, 9, 0),
      L("WINDOW", 5, 0.1, 9, 0.1),
      L("WINDOW", 5, 0.2, 9, 0.2),
    ]);
    expect(r.openings.filter((o) => o.type === "window")).toHaveLength(3);
  });
  it("O2 a stray door line 100 ft away is snapped onto the nearest wall (no tolerance)", () => {
    const d = g([walls, L("DOORS", 100, 100, 103, 100)]).openings[0];
    expect(d.x).toBeDefined();
    expect(d.x!).toBeLessThanOrEqual(20);
  });
});
