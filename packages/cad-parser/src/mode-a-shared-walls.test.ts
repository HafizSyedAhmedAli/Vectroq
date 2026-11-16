// Phase 2, Stage 2: Mode A shared-wall integration (tests A-G).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Geometry, ParseUnitInfo } from "@vectroq/shared-types";
import {
  dxfToGeometry,
  type RawDxfDocument,
  type RawEntity,
} from "./dxf-to-geometry";
import {
  buildModeAWalls,
  interiorSide,
  isSimplePolygon,
  signedArea2,
} from "./mode-a-walls";
import { parseDxf, parseDxfToGeometry } from "./parse-dxf";
import { ParseReport } from "./report";

type P = { x: number; y: number };
const fixtures = join(__dirname, "../fixtures");
const baseline = (n: string) =>
  JSON.parse(
    readFileSync(join(__dirname, `../baselines/legacy/${n}.json`), "utf8"),
  ) as Geometry;
const fixtureText = (n: string) => readFileSync(join(fixtures, n), "utf8");

/** Rectangle CCW as (x0,y0)->(x1,y0)->(x1,y1)->(x0,y1), closed with a repeated first vertex. */
const rect = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  cw = false,
): P[] => {
  const ccw = [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
  const v = cw ? [ccw[0], ccw[3], ccw[2], ccw[1]] : ccw;
  return [...v, { ...v[0] }];
};
const poly = (vertices: P[]): RawEntity => ({
  type: "LWPOLYLINE",
  layer: "WALLS",
  vertices,
});
const doc = (...polys: P[][]): RawDxfDocument => ({
  entities: polys.map(poly),
});

const run = (polys: P[][]) => {
  const report = new ParseReport();
  const g = dxfToGeometry(doc(...polys), undefined, { report });
  const meta = report.toMeta({} as ParseUnitInfo);
  return { g, meta, codes: meta.warnings.map((w) => w.code) };
};
const len = (g: Geometry) => g.walls.reduce((s, w) => s + w.length, 0);
const key = (w: Geometry["walls"][number]) => [
  w.startX,
  w.startY,
  w.endX,
  w.endY,
];

// ---------------------------------------------------------------- A
describe("A. sample-house.dxf regression", () => {
  const before = baseline("sample-house");
  const { geometry: g, meta } = parseDxf(fixtureText("sample-house.dxf"));

  it("12 walls / 158 ft become 10 walls / 138 ft", () => {
    expect(before.walls).toHaveLength(12);
    expect(before.walls.reduce((s, w) => s + w.length, 0)).toBe(158);
    expect(g.walls).toHaveLength(10);
    expect(len(g)).toBe(138);
  });
  it("both shared edges are one full 18 ft run, keeping the first contributor's id and direction", () => {
    const w01 = g.walls.find((w) => w.id === "wall-0-1")!;
    const w11 = g.walls.find((w) => w.id === "wall-1-1")!;
    expect(key(w01)).toEqual([20, 0, 20, 18]);
    expect(key(w11)).toEqual([35, 0, 35, 18]);
    expect([w01.length, w11.length]).toEqual([18, 18]);
    expect(g.walls.map((w) => w.id)).not.toContain("wall-1-3");
    expect(g.walls.map((w) => w.id)).not.toContain("wall-2-3");
  });
  it("every other wall is bit-identical to the old output, in the same order", () => {
    const gone = new Set(["wall-1-3", "wall-2-3"]);
    const changed = new Set(["wall-0-1", "wall-1-1"]);
    const expected = before.walls.filter(
      (w) => !gone.has(w.id) && !changed.has(w.id),
    );
    const actual = g.walls.filter((w) => !changed.has(w.id));
    expect(actual).toEqual(expected);
    expect(g.walls.map((w) => w.thickness)).toEqual(Array(10).fill(0.75));
    expect(g.walls.map((w) => w.height)).toEqual(Array(10).fill(10));
  });
  it("rooms are unchanged: Kitchen 240, Living Room 270, Bathroom 48, total 558", () => {
    expect(g.rooms).toEqual(before.rooms);
    const area = (n: string) => g.rooms.find((r) => r.name === n)!.area;
    expect([area("Kitchen"), area("Living Room"), area("Bathroom")]).toEqual([
      240, 270, 48,
    ]);
    expect(g.rooms.reduce((s, r) => s + r.area, 0)).toBe(558);
  });
  it("openings are unchanged: same count, dimensions, placement and door angle", () => {
    expect(g.openings).toEqual(before.openings);
    expect(g.openings.filter((o) => o.type === "door")).toHaveLength(1);
    expect(g.openings.filter((o) => o.type === "window")).toHaveLength(1);
    expect(g.openings.find((o) => o.type === "door")!.angle).toBe(Math.PI / 2);
  });
  it("reports the merge as stats and raises no wall warnings", () => {
    expect(meta.stats.wallsMerged).toBe(2);
    expect(meta.stats.wallLengthRemovedFt).toBe(20);
    expect(meta.stats.walls).toBe(10);
    expect(meta.warnings.filter((w) => w.code.startsWith("WALL_"))).toEqual([]);
  });
});

// ---------------------------------------------------------------- B
describe("B. polygon winding decides the side", () => {
  it("interiorSide: CCW is left, CW is right, no area is undefined", () => {
    expect(interiorSide(rect(0, 0, 4, 3))).toBe("left");
    expect(interiorSide(rect(0, 0, 4, 3, true))).toBe("right");
    expect(
      interiorSide([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ]),
    ).toBeUndefined();
    expect(signedArea2(rect(0, 0, 4, 3))).toBe(24);
    expect(signedArea2(rect(0, 0, 4, 3, true))).toBe(-24);
  });
  const cases: [string, boolean, boolean][] = [
    ["CCW + CCW", false, false],
    ["CW + CW", true, true],
    ["CCW + CW", false, true],
    ["CW + CCW", true, false],
  ];
  for (const [name, c1, c2] of cases)
    it(`${name}: two adjacent rooms share one wall`, () => {
      const { g, codes } = run([rect(0, 0, 10, 8, c1), rect(10, 0, 20, 8, c2)]);
      expect(g.walls).toHaveLength(7);
      expect(len(g)).toBe(64); // 2 x 36 ft perimeter, minus the 8 ft wall drawn twice
      expect(codes).toEqual([]);
      expect(g.rooms.map((r) => r.area)).toEqual([80, 80]);
    });
});

// ---------------------------------------------------------------- C
describe("C. same-side overlaps are refused and reported", () => {
  it("two identical outlines: nothing merges, all 8 walls stay, a warning is raised", () => {
    const { g, codes } = run([rect(0, 0, 10, 8), rect(0, 0, 10, 8)]);
    expect(g.walls).toHaveLength(8);
    expect(len(g)).toBe(72);
    expect(codes).toContain("WALL_SAME_SIDE_OVERLAP");
  });
  it("nested rectangles sharing part of an edge: not merged, both represented", () => {
    const { g, codes } = run([rect(0, 0, 10, 8), rect(2, 0, 6, 4)]);
    expect(g.walls).toHaveLength(8);
    expect(len(g)).toBe(36 + 16);
    expect(codes).toContain("WALL_SAME_SIDE_OVERLAP");
  });
  it("the side is the physical interior, so reversing one of two identical outlines does not make them a shared wall", () => {
    // Both rooms lie on the same side of every coincident edge, whatever the winding.
    const { g, codes } = run([rect(0, 0, 10, 8), rect(0, 0, 10, 8, true)]);
    expect(codes).toContain("WALL_SAME_SIDE_OVERLAP");
    expect(g.walls).toHaveLength(8);
  });
});

// ---------------------------------------------------------------- D
describe("D. face-offset walls are not merged", () => {
  it("rooms drawn 0.75 ft apart keep both walls and report the refusal", () => {
    const { g, codes } = run([rect(0, 0, 10, 8), rect(10.75, 0, 20, 8)]);
    expect(g.walls).toHaveLength(8);
    expect(codes).toContain("WALL_FACE_OFFSET");
    expect(g.walls.every((w) => w.thickness === 0.75)).toBe(true);
  });
});

// ---------------------------------------------------------------- E
describe("E. unrelated geometry is unchanged", () => {
  it("a single room, and rooms that only touch at a corner", () => {
    expect(run([rect(0, 0, 10, 8)]).g.walls).toHaveLength(4);
    const { g, codes } = run([rect(0, 0, 10, 8), rect(10, 8, 20, 16)]);
    expect(g.walls).toHaveLength(8);
    expect(codes).toEqual([]);
  });
  it("rooms far apart, and rooms in a row that do not overlap, are untouched", () => {
    const { g } = run([rect(0, 0, 10, 8), rect(30, 0, 40, 8)]);
    expect(g.walls).toHaveLength(8);
    expect(len(g)).toBe(72);
  });
  it("an L-shaped room next to a rectangle: only the true shared run merges", () => {
    const L: P[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 4 },
      { x: 5, y: 4 },
      { x: 5, y: 8 },
      { x: 0, y: 8 },
      { x: 0, y: 0 },
    ];
    const { g } = run([L, rect(10, 0, 16, 4)]);
    // shared edge is x=10, y 0..4 (4 ft)
    expect(g.walls).toHaveLength(6 + 4 - 1);
    expect(len(g)).toBeCloseTo(36 + 20 - 4);
  });
  it("a T junction (an apex touching the middle of a wall) is not merged", () => {
    const tri: P[] = [
      { x: 5, y: 4 },
      { x: 8, y: 9 },
      { x: 2, y: 9 },
      { x: 5, y: 4 },
    ];
    const { g, codes } = run([rect(0, 0, 10, 4), tri]);
    expect(g.walls).toHaveLength(7);
    expect(codes).toEqual([]);
  });
  it("an X junction (four rooms around one point) keeps each shared wall once", () => {
    const { g, codes } = run([
      rect(0, 0, 5, 5),
      rect(5, 0, 10, 5),
      rect(0, 5, 5, 10),
      rect(5, 5, 10, 10),
    ]);
    expect(g.walls).toHaveLength(12);
    expect(len(g)).toBe(60);
    expect(codes).toEqual([]);
  });
  it("different thicknesses are not merged (buildModeAWalls does not invent thickness; every edge keeps the supplied one)", () => {
    const walls = buildModeAWalls([rect(0, 0, 10, 8), rect(10, 0, 20, 8)], {
      height: 10,
      thickness: 0.5,
    });
    expect(walls.every((w) => w.thickness === 0.5)).toBe(true);
    expect(walls).toHaveLength(7);
  });
  it("edges of the same polygon are never merged with each other (spur / out-and-back)", () => {
    // A polygon whose own opposite edges lie on one line 0.03 ft apart.
    const thin = rect(0, 0, 10, 0.03);
    const { g, codes } = run([thin]);
    expect(g.walls).toHaveLength(4);
    expect(codes).toContain("WALL_SAME_POLYGON_OVERLAP");
  });
  it("a self-crossing outline is excluded from merging with a warning, walls kept as drawn", () => {
    const bow: P[] = [
      { x: 0, y: 0 },
      { x: 10, y: 8 },
      { x: 10, y: 0 },
      { x: 0, y: 8 },
      { x: 0, y: 0 },
    ];
    expect(isSimplePolygon(bow)).toBe(false);
    const { g, codes } = run([bow]);
    expect(g.walls).toHaveLength(4);
    expect(codes).toEqual(["WALL_POLYGON_NOT_MERGED"]);
  });
  it("without a report the walls are identical", () => {
    const a = dxfToGeometry(doc(rect(0, 0, 10, 8), rect(0, 0, 10, 8)));
    const b = run([rect(0, 0, 10, 8), rect(0, 0, 10, 8)]).g;
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------- F
describe("F. direction and winding reversal", () => {
  const norm = (g: Geometry) =>
    g.walls
      .map((w) => ({
        a: [
          Math.min(w.startX, w.endX),
          Math.min(w.startY, w.endY),
          Math.max(w.startX, w.endX),
          Math.max(w.startY, w.endY),
        ],
        len: w.length,
      }))
      .sort((p, q) => JSON.stringify(p.a).localeCompare(JSON.stringify(q.a)));

  it("reversing any polygon does not change which physical walls exist", () => {
    const base = norm(
      run([rect(0, 0, 10, 8), rect(10, 0, 20, 8), rect(20, 0, 30, 8)]).g,
    );
    for (const mask of [0b001, 0b010, 0b100, 0b101, 0b111]) {
      const polys = [0, 1, 2].map((i) =>
        rect(i * 10, 0, i * 10 + 10, 8, Boolean(mask & (1 << i))),
      );
      expect(norm(run(polys).g)).toEqual(base);
    }
  });
  it("reversing the input order of polygons keeps the same physical walls and rooms' areas", () => {
    const polys = [rect(0, 0, 10, 8), rect(10, 0, 20, 8), rect(20, 0, 30, 8)];
    expect(norm(run([...polys].reverse()).g)).toEqual(norm(run(polys).g));
  });
  it("a shared wall always ends up exactly once, whichever polygon is first", () => {
    const a = run([rect(0, 0, 10, 8), rect(10, 0, 20, 8)]).g;
    const b = run([rect(10, 0, 20, 8), rect(0, 0, 10, 8)]).g;
    expect(
      a.walls.filter(
        (w) =>
          Math.min(w.startX, w.endX) === 10 &&
          Math.max(w.startX, w.endX) === 10,
      ),
    ).toHaveLength(1);
    expect(
      b.walls.filter(
        (w) =>
          Math.min(w.startX, w.endX) === 10 &&
          Math.max(w.startX, w.endX) === 10,
      ),
    ).toHaveLength(1);
  });
  it("sample-house, reversed outlines: same wall count, length and room areas", () => {
    const text = fixtureText("sample-house.dxf");
    const ref = parseDxfToGeometry(text);
    expect(ref.walls).toHaveLength(10);
    const g = dxfToGeometry({
      entities: [...ref.rooms]
        .reverse()
        .map((r) => poly([...r.shapes[0]].reverse())),
    });
    expect(g.walls).toHaveLength(10);
    expect(len(g)).toBe(138);
  });
});

// ---------------------------------------------------------------- G
describe("G. Mode B is unchanged", () => {
  for (const n of ["whole_house_connected", "whole_house_simple_plan"])
    it(`${n}.dxf equals its legacy baseline exactly and has no wall warnings`, () => {
      const r = parseDxf(fixtureText(`${n}.dxf`));
      expect(JSON.parse(JSON.stringify(r.geometry))).toEqual(baseline(n));
      expect(r.meta.warnings.filter((w) => w.code.startsWith("WALL_"))).toEqual(
        [],
      );
      expect(r.meta.stats.wallsMerged).toBeUndefined();
    });
});
