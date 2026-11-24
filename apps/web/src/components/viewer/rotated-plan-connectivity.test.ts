// @vitest-environment node
// Phase 2, Stage 3b: a plan drawn rotated is normalized by the parser, so the
// existing room-connection logic (connect-rooms.ts) sees the same rooms and adds
// the same connecting openings as for the unrotated drawing.
import { describe, expect, it } from "vitest";
import { parseDxf } from "@vectroq/cad-parser";
import { addConnectingOpenings } from "./connect-rooms";

type P = [number, number];
const D = Math.PI / 180;
const rot = ([x, y]: P, a: number): P => [
  x * Math.cos(a) - y * Math.sin(a),
  x * Math.sin(a) + y * Math.cos(a),
];

function dxf(alpha: number): string {
  const o: (string | number)[] = [
    "0",
    "SECTION",
    "2",
    "HEADER",
    "9",
    "$INSUNITS",
    "70",
    2,
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "ENTITIES",
  ];
  const poly = (pts: P[]) => {
    o.push("0", "LWPOLYLINE", "8", "WALLS", "90", pts.length, "70", 1);
    for (const p of pts) {
      const [x, y] = rot(p, alpha);
      o.push("10", x, "20", y);
    }
  };
  const line = (layer: string, a: P, b: P) => {
    o.push("0", "LINE", "8", layer);
    const [x1, y1] = rot(a, alpha);
    const [x2, y2] = rot(b, alpha);
    o.push("10", x1, "20", y1, "30", 0, "11", x2, "21", y2, "31", 0);
  };
  const text = (p: P, t: string) => {
    const [x, y] = rot(p, alpha);
    o.push(
      "0",
      "TEXT",
      "8",
      "ROOMS",
      "10",
      x,
      "20",
      y,
      "30",
      0,
      "40",
      0.5,
      "1",
      t,
      "50",
      alpha / D,
    );
  };
  poly([
    [0, 0],
    [15, 0],
    [15, 12],
    [0, 12],
  ]);
  poly([
    [15, 0],
    [30, 0],
    [30, 12],
    [15, 12],
  ]);
  poly([
    [30, 0],
    [45, 0],
    [45, 12],
    [30, 12],
  ]);
  text([7, 6], "Living");
  text([22, 6], "Kitchen");
  text([37, 6], "Bedroom");
  line("DOORS", [15, 3], [15, 6]); // Living <-> Kitchen
  line("WINDOWS", [5, 0], [9, 0]);
  o.push("0", "ENDSEC", "0", "EOF");
  return o.join("\n");
}

const summary = (text: string) => {
  const g = addConnectingOpenings(parseDxf(text).geometry);
  return {
    rooms: g.rooms.map((r) => [r.name, Math.round(r.area * 1e6) / 1e6]).sort(),
    walls: g.walls.length,
    openings: g.openings
      .map((o) => [o.type, Math.round(o.width * 1e6) / 1e6])
      .sort(),
  };
};

describe("room connectivity on rotated plans", () => {
  const base = summary(dxf(0));
  it("the unrotated plan has three rooms and its openings", () => {
    expect(base.rooms).toHaveLength(3);
    expect(base.openings.length).toBeGreaterThanOrEqual(2);
  });
  for (const deg of [-44, -20, 0.5, 15, 33, 44])
    it(`${deg} degrees: same rooms, areas, walls and connecting openings`, () => {
      expect(summary(dxf(deg * D))).toEqual(base);
    });
});
