// Phase 2, Stage 3b: end-to-end rotation normalization through parseDxf, for
// Mode A (closed WALLS polylines) and Mode B (WALLS LINEs). Each plan is
// generated once in the canonical frame, then written out rotated by an angle;
// parsing the rotated text must reproduce the unrotated parse.
import { describe, expect, it } from "vitest";
import type { Geometry } from "@vectroq/shared-types";
import { parseDxf } from "./parse-dxf";
import { polygonArea } from "./polygon";

const D = Math.PI / 180;
type P = [number, number];
type Ent =
  | { k: "poly"; layer: string; pts: P[] }
  | { k: "line"; layer: string; a: P; b: P }
  | { k: "arc"; layer: string; c: P; r: number; a0: number; a1: number }
  | { k: "text"; layer: string; p: P; text: string }
  | { k: "circle"; layer: string; c: P; r: number };

const rp = ([x, y]: P, a: number): P => [
  x * Math.cos(a) - y * Math.sin(a),
  x * Math.sin(a) + y * Math.cos(a),
];

/** DXF text with the given entities rotated by `alpha` (radians, counter-clockwise). */
function dxf(ents: Ent[], alpha = 0, insunits = 2): string {
  const o: (string | number)[] = [
    "0",
    "SECTION",
    "2",
    "HEADER",
    "9",
    "$INSUNITS",
    "70",
    insunits,
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "ENTITIES",
  ];
  const pt = (p: P, i = 0) => {
    const [x, y] = rp(p, alpha);
    o.push(10 + i, x, 20 + i, y, 30 + i, 0);
  };
  for (const e of ents) {
    if (e.k === "poly") {
      o.push("0", "LWPOLYLINE", "8", e.layer, "90", e.pts.length, "70", 1);
      for (const p of e.pts) {
        const [x, y] = rp(p, alpha);
        o.push("10", x, "20", y);
      }
    } else if (e.k === "line") {
      o.push("0", "LINE", "8", e.layer);
      pt(e.a, 0);
      pt(e.b, 1);
    } else if (e.k === "arc") {
      o.push("0", "ARC", "8", e.layer);
      pt(e.c, 0);
      o.push("40", e.r, "50", e.a0 + alpha / D, "51", e.a1 + alpha / D);
    } else if (e.k === "circle") {
      o.push("0", "CIRCLE", "8", e.layer);
      pt(e.c, 0);
      o.push("40", e.r);
    } else {
      o.push("0", "TEXT", "8", e.layer);
      pt(e.p, 0);
      o.push("40", 0.5, "1", e.text, "50", alpha / D);
    }
  }
  o.push("0", "ENDSEC", "0", "EOF");
  return o.join("\n");
}

const R = (x0: number, y0: number, x1: number, y1: number): P[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];
const poly = (pts: P[]): Ent => ({ k: "poly", layer: "WALLS", pts });
const wl = (a: P, b: P): Ent => ({ k: "line", layer: "WALLS", a, b });
const door = (a: P, b: P): Ent => ({ k: "line", layer: "DOORS", a, b });
const win = (a: P, b: P): Ent => ({ k: "line", layer: "WINDOWS", a, b });
const arc = (c: P, r: number, a0: number, a1: number): Ent => ({
  k: "arc",
  layer: "DOORS",
  c,
  r,
  a0,
  a1,
});
const text = (p: P, t: string): Ent => ({
  k: "text",
  layer: "ROOMS",
  p,
  text: t,
});
const outline = (x0: number, y0: number, x1: number, y1: number): Ent[] => {
  const r = R(x0, y0, x1, y1);
  return r.map((p, i) => wl(p, r[(i + 1) % 4]));
};

// Unrelated geometry on other layers, which must rotate with the plan but never affect it
const EXTRAS: Ent[] = [
  { k: "circle", layer: "TREES", c: [60, 60], r: 2 },
  { k: "line", layer: "GRID", a: [100, 100], b: [103, 104] },
  { k: "line", layer: "GRID", a: [-30, 5], b: [-27, 9] },
];

// ---- Mode A: three rooms. R1 and R2 share x = 15; R3 sits on top, sharing y = 12 with both.
const MODE_A: Ent[] = [
  poly(R(0, 0, 15, 12)),
  poly(R(15, 0, 30, 12)),
  poly([
    [0, 12],
    [30, 12],
    [30, 20],
    [12, 20],
    [12, 28],
    [0, 28],
  ]),
  text([7, 6], "Living"),
  text([22, 6], "Kitchen 180 sq ft"),
  text([6, 22], "Bath"),
  door([15, 3], [18, 3]), // hinge-style on the shared wall, arc says the leaf lies along +y
  arc([15, 3], 3, 0, 90),
  door([15, 8], [18, 8]), // no arc
  door([0, 4], [0, 7]), // flat, on an unshared wall
  door([12, 21], [15, 21]), // hinge-style with an arc, next to a perpendicular wall
  arc([12, 21], 3, 0, 90),
  door([20, 12], [20, 15]), // no arc, on the contained duplicate run
  door([5, 12], [5, 14]), // no arc, hinge-style, on the top wall of R1
  win([5, 0], [9, 0]),
  win([30, 3], [30, 6]),
  win([22, 12], [26, 12]),
  win([0, 15], [0, 18]),
  ...EXTRAS,
];

// ---- Mode B: LINEs. A 30 x 20 house, a 15 ft wall and a 15 ft partition, openings on them.
const MODE_B: Ent[] = [
  ...outline(0, 0, 30, 20),
  wl([15, 0], [15, 20]),
  wl([15, 10], [30, 10]),
  text([7, 10], "Living"),
  text([22, 5], "Kitchen"),
  text([22, 15], "Bath 40 sq ft"),
  door([15, 4], [18, 4]),
  arc([15, 4], 3, 0, 90),
  door([15, 14], [15, 17]),
  door([20, 10], [23, 10]),
  arc([20, 10], 3, 0, 90),
  door([0, 5], [0, 8]),
  win([5, 0], [10, 0]),
  win([30, 12], [30, 16]),
  win([18, 20], [24, 20]),
  win([0, 12], [0, 16]),
  ...EXTRAS,
];

const ANGLES = [0.01, 0.1, 1, 15, 30, 44, -0.01, -0.1, -1, -15, -30, -44];
const TOL = 1e-6;
const angDiff = (a: number, b: number) => {
  const d =
    ((((a - b) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return Math.abs(d);
};

/** Compares two geometries field by field, numbers to `tol`, everything else exactly. */
function expectSame(got: Geometry, want: Geometry, tol = TOL) {
  const num = (a: number | undefined, b: number | undefined, what: string) => {
    if (a === undefined || b === undefined) return expect(a, what).toBe(b);
    expect(Math.abs(a - b), `${what}: ${a} vs ${b}`).toBeLessThanOrEqual(tol);
  };
  expect(got.walls).toHaveLength(want.walls.length);
  got.walls.forEach((w, i) => {
    const v = want.walls[i];
    expect(w.id).toBe(v.id);
    for (const k of [
      "startX",
      "startY",
      "endX",
      "endY",
      "length",
      "height",
      "thickness",
    ] as const)
      num(w[k], v[k], `wall ${i}.${k}`);
  });
  expect(got.rooms).toHaveLength(want.rooms.length);
  got.rooms.forEach((r, i) => {
    const v = want.rooms[i];
    expect([r.id, r.name, r.type]).toEqual([v.id, v.name, v.type]);
    num(r.area, v.area, `room ${i}.area`);
    num(r.labelX, v.labelX, `room ${i}.labelX`);
    num(r.labelY, v.labelY, `room ${i}.labelY`);
    expect(r.shapes).toHaveLength(v.shapes.length);
    r.shapes.forEach((sh, j) =>
      sh.forEach((p, k) => {
        num(p.x, v.shapes[j][k].x, `room ${i} shape ${j}.${k}.x`);
        num(p.y, v.shapes[j][k].y, `room ${i} shape ${j}.${k}.y`);
      }),
    );
  });
  expect(got.openings).toHaveLength(want.openings.length);
  got.openings.forEach((o, i) => {
    const v = want.openings[i];
    expect([o.id, o.type]).toEqual([v.id, v.type]);
    for (const k of ["x", "y", "width", "height", "hingeX", "hingeY"] as const)
      num(o[k], v[k], `${o.id}.${k}`);
    expect(
      angDiff(o.angle ?? 0, v.angle ?? 0),
      `${o.id}.angle`,
    ).toBeLessThanOrEqual(tol);
    if (v.openAngle !== undefined)
      expect(
        angDiff(o.openAngle ?? 0, v.openAngle),
        `${o.id}.openAngle`,
      ).toBeLessThanOrEqual(tol);
    else expect(o.openAngle).toBeUndefined();
  });
}

const reorder = {
  "source order": (e: Ent[]) => e,
  "entity order reversed": (e: Ent[]) => [...e].reverse(),
  "wall/opening lines reversed end to end": (e: Ent[]) =>
    e.map((x) => (x.k === "line" ? { ...x, a: x.b, b: x.a } : x)),
  "polygon winding reversed": (e: Ent[]) =>
    e.map((x) => (x.k === "poly" ? { ...x, pts: [...x.pts].reverse() } : x)),
};

for (const [mode, plan] of [
  ["Mode A", MODE_A],
  ["Mode B", MODE_B],
] as const) {
  describe(`${mode}: rotated plan normalizes to the unrotated parse`, () => {
    for (const [tn, tf] of Object.entries(reorder)) {
      if (mode === "Mode B" && tn === "polygon winding reversed") continue;
      if (
        mode === "Mode A" &&
        tn === "wall/opening lines reversed end to end"
      ) {
        // wall LINEs do not exist in Mode A, but door/window lines do
      }
      const src = tf(plan);
      const base = parseDxf(dxf(src));
      it(`${tn}: the unrotated parse is a plausible plan (sanity)`, () => {
        expect(base.meta.rotationRad).toBe(0);
        expect(base.geometry.rooms).toHaveLength(3);
        expect(base.geometry.openings).toHaveLength(mode === "Mode A" ? 10 : 8);
      });
      for (const deg of ANGLES)
        it(`${tn}, rotated ${deg} degrees: identical geometry, rotationRad ${-deg} degrees`, () => {
          const r = parseDxf(dxf(src, deg * D));
          expectSame(r.geometry, base.geometry);
          expect(r.meta.rotationRad).toBeCloseTo(-deg * D, 9);
        });
    }

    it("the 45 degree boundary and beyond land on an equivalent axis-aligned plan (same areas, lengths, counts)", () => {
      const base = parseDxf(dxf(plan));
      for (const deg of [45, -45, 60, 90, 135, 180, -120]) {
        const r = parseDxf(dxf(plan, deg * D));
        const ra = Math.abs(r.meta.rotationRad!);
        expect(ra).toBeLessThanOrEqual(Math.PI / 4 + 1e-9);
        expect(r.geometry.walls).toHaveLength(base.geometry.walls.length);
        expect(
          r.geometry.rooms.map((x) => Math.round(x.area * 1e6)).sort(),
        ).toEqual(
          base.geometry.rooms.map((x) => Math.round(x.area * 1e6)).sort(),
        );
        expect(r.geometry.walls.reduce((s, w) => s + w.length, 0)).toBeCloseTo(
          base.geometry.walls.reduce((s, w) => s + w.length, 0),
          6,
        );
        expect(r.geometry.openings).toHaveLength(base.geometry.openings.length);
        // every wall is axis-aligned afterwards
        for (const w of r.geometry.walls)
          expect(
            Math.min(Math.abs(w.endX - w.startX), Math.abs(w.endY - w.startY)),
          ).toBeLessThan(1e-6);
      }
    });

    it("metadata: rotationRad is the applied angle, with an info message; no warning noise", () => {
      const r = parseDxf(dxf(plan, 20 * D));
      expect(r.meta.rotationRad).toBeCloseTo(-20 * D, 9);
      expect(
        r.meta.warnings.some(
          (w) => w.code === "PLAN_ROTATED" && w.severity === "info",
        ),
      ).toBe(true);
      expect(r.meta.warnings.some((w) => w.code === "ROTATION_UNCERTAIN")).toBe(
        false,
      );
      const r0 = parseDxf(dxf(plan));
      expect(r0.meta.rotationRad).toBe(0);
      expect(Object.is(r0.meta.rotationRad, -0)).toBe(false);
      expect(
        r0.meta.warnings.some((w) =>
          /^(PLAN_ROTATED|ROTATION_UNCERTAIN)$/.test(w.code),
        ),
      ).toBe(false);
    });

    it("INV-1..5 hold on the rotated plan", () => {
      for (const deg of [-31, 12, 44]) {
        const g = parseDxf(dxf(plan, deg * D)).geometry;
        const b = parseDxf(dxf(plan)).geometry;
        // INV-5: lengths in feet, one frame
        for (const w of g.walls)
          expect(w.length).toBeCloseTo(
            Math.hypot(w.endX - w.startX, w.endY - w.startY),
            9,
          );
        expect(g.walls.reduce((s, w) => s + w.length, 0)).toBeCloseTo(
          b.walls.reduce((s, w) => s + w.length, 0),
          6,
        );
        // INV-4: room area is the centreline polygon area
        g.rooms.forEach((r, i) => {
          expect(r.area).toBeCloseTo(b.rooms[i].area, 6);
          expect(polygonArea(r.shapes[0])).toBeCloseTo(
            polygonArea(b.rooms[i].shapes[0]),
            6,
          );
        });
        // INV-3: no extra rooms
        expect(g.rooms).toHaveLength(b.rooms.length);
        // INV-2: no two walls are the same physical run
        const key = (w: (typeof g.walls)[number]) =>
          [
            [w.startX, w.startY],
            [w.endX, w.endY],
          ]
            .map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`)
            .sort()
            .join("|");
        const keys = g.walls.map(key);
        expect(new Set(keys).size).toBe(keys.length);
        // INV-1: walls stay gross: openings do not shorten or split walls
        expect(g.walls).toHaveLength(b.walls.length);
        // opening sizes unchanged
        g.openings.forEach((o, i) => {
          expect(o.width).toBeCloseTo(b.openings[i].width, 9);
          expect(o.height).toBe(b.openings[i].height);
        });
      }
    });

    it("wall thickness and construction defaults are unchanged by rotation", () => {
      const g = parseDxf(dxf(plan, 27 * D)).geometry;
      const b = parseDxf(dxf(plan)).geometry;
      expect(g.walls.map((w) => w.thickness)).toEqual(
        b.walls.map((w) => w.thickness),
      );
      expect(g.walls.map((w) => w.height)).toEqual(
        b.walls.map((w) => w.height),
      );
    });

    it("a drawing in millimetres rotates in feet and gives the same geometry as the unrotated one", () => {
      const mm = (e: Ent[]): Ent[] =>
        e.map((x) => {
          const s = (p: P): P => [p[0] * 304.8, p[1] * 304.8];
          if (x.k === "poly") return { ...x, pts: x.pts.map(s) };
          if (x.k === "line") return { ...x, a: s(x.a), b: s(x.b) };
          if (x.k === "arc") return { ...x, c: s(x.c), r: x.r * 304.8 };
          if (x.k === "circle") return { ...x, c: s(x.c), r: x.r * 304.8 };
          return { ...x, p: s(x.p) };
        });
      const base = parseDxf(dxf(mm(plan), 0, 4));
      const rot = parseDxf(dxf(mm(plan), 18 * D, 4));
      expect(rot.meta.rotationRad).toBeCloseTo(-18 * D, 9);
      expect(rot.geometry.walls).toHaveLength(base.geometry.walls.length);
      expectSame(rot.geometry, base.geometry, 1e-4);
    });

    it("unrelated geometry and stray lines on other layers do not change the result", () => {
      const without = plan.filter((e) => !EXTRAS.includes(e));
      const a = parseDxf(dxf(without, 22 * D));
      const b = parseDxf(dxf(plan, 22 * D));
      expectSame(b.geometry, a.geometry);
      expect(b.meta.rotationRad).toBeCloseTo(a.meta.rotationRad!, 12);
    });

    it("a rotated plan is not rejected by downstream bounding-box checks: rooms are axis-aligned rectangles/L shapes in the normalized frame", () => {
      const g = parseDxf(dxf(plan, 33 * D)).geometry;
      for (const r of g.rooms)
        for (let i = 0; i < r.shapes[0].length; i++) {
          const p = r.shapes[0][i];
          const q = r.shapes[0][(i + 1) % r.shapes[0].length];
          expect(
            Math.min(Math.abs(p.x - q.x), Math.abs(p.y - q.y)),
          ).toBeLessThan(1e-6);
        }
    });
  });
}

describe("opening semantics after normalization (explicit pins)", () => {
  const find = (g: Geometry, id: string) =>
    g.openings.find((o) => o.id === id)!;
  for (const deg of [-44, -17, 0.01, 23, 44]) {
    it(`${deg} degrees: windows sit at their drawn midpoint (no half-width displacement), doors keep hinge, width and swing`, () => {
      for (const [plan, wins] of [
        [
          MODE_A,
          {
            "window-0": [7, 0],
            "window-1": [30, 4.5],
            "window-2": [24, 12],
            "window-3": [0, 16.5],
          },
        ],
        [
          MODE_B,
          {
            "window-0": [7.5, 0],
            "window-1": [30, 14],
            "window-2": [21, 20],
            "window-3": [0, 14],
          },
        ],
      ] as const) {
        const g = parseDxf(dxf(plan, deg * D)).geometry;
        for (const [id, [x, y]] of Object.entries(wins)) {
          expect(find(g, id).x!, `${id}.x`).toBeCloseTo(x, 6);
          expect(find(g, id).y!, `${id}.y`).toBeCloseTo(y, 6);
        }
      }
      const a = parseDxf(dxf(MODE_A, deg * D)).geometry;
      // door-0: hinge at the arc centre (15, 3), width 3, leaf open along +x, an arc-informed swing
      expect(find(a, "door-0").hingeX!).toBeCloseTo(15, 6);
      expect(find(a, "door-0").hingeY!).toBeCloseTo(3, 6);
      expect(find(a, "door-0").width).toBeCloseTo(3, 9);
      expect(find(a, "door-0").openAngle!).toBeCloseTo(0, 6);
      // door-0's arc says the closed leaf lies along +y: centre at (15, 4.5)
      expect(find(a, "door-0").x!).toBeCloseTo(15, 6);
      expect(find(a, "door-0").y!).toBeCloseTo(4.5, 6);
      // door-3 (flat, unshared wall): centre at the drawn midpoint
      expect(find(a, "door-2").x!).toBeCloseTo(0, 6);
      expect(find(a, "door-2").y!).toBeCloseTo(5.5, 6);
    });
  }
  it("a no-arc shared-wall door follows the first polygon's wall direction, rotated or not (Stage 3b-0 contract kept)", () => {
    const swap = (e: Ent[]) => [e[1], e[0], ...e.slice(2)];
    for (const deg of [0, 19, -36]) {
      const first = find(parseDxf(dxf(MODE_A, deg * D)).geometry, "door-1");
      const second = find(
        parseDxf(dxf(swap(MODE_A), deg * D)).geometry,
        "door-1",
      );
      // R1 first: R1's right edge points +y, so the centre is at y = 8 + 1.5; R2 first: its left edge points -y
      expect(first.y!).toBeCloseTo(9.5, 6);
      expect(second.y!).toBeCloseTo(6.5, 6);
      expect(first.x!).toBeCloseTo(15, 6);
      // the hinge is the same whichever room is first
      expect(second.hingeY!).toBeCloseTo(first.hingeY!, 6);
    }
  });
});

describe("door semantics after normalization: no arc, blocked arc, arc-informed", () => {
  // Mode B house. Doors on the bottom wall (y = 0):
  //   door-0 hinge (10, 0): arc says the closed leaf lies toward -x, but a partition ends at (8.5, 0) inside that span, so the arc is ignored (blocked) -> default side
  //   door-1 hinge (20, 0): same arc, nothing in the way -> arc-informed, toward -x
  //   door-2 hinge (25, 0): no arc -> default side (the wall's drawn direction, +x)
  const H = 3;
  const house: Ent[] = [
    ...outline(0, 0, 30, 20),
    wl([8.5, 0], [8.5, 20]),
    text([4, 10], "Left"),
    text([20, 10], "Right"),
    door([10, 0], [10, H]),
    arc([10, 0], H, 90, 180),
    door([20, 0], [20, H]),
    arc([20, 0], H, 90, 180),
    door([25, 0], [25, H]),
  ];
  const noArc = house.filter((e) => e.k !== "arc" || e.c[0] !== 10);
  const find = (g: Geometry, id: string) =>
    g.openings.find((o) => o.id === id)!;

  for (const deg of [0, 0.01, -0.01, 15, -15, 30, -30, 44, -44]) {
    it(`${deg} degrees: blocked arc takes the default side, arc-informed door follows its arc, no-arc door takes the default side`, () => {
      const g = parseDxf(dxf(house, deg * D)).geometry;
      const d0 = find(g, "door-0");
      const d1 = find(g, "door-1");
      const d2 = find(g, "door-2");
      // blocked: centre half a width along +x from the hinge (the wall's drawn direction)
      expect(d0.x!).toBeCloseTo(11.5, 6);
      expect(d0.y!).toBeCloseTo(0, 6);
      expect(d0.hingeX!).toBeCloseTo(10, 6);
      expect(d0.hingeY!).toBeCloseTo(0, 6);
      // arc-informed: toward -x
      expect(d1.x!).toBeCloseTo(18.5, 6);
      expect(d1.hingeX!).toBeCloseTo(20, 6);
      // no arc: default side
      expect(d2.x!).toBeCloseTo(26.5, 6);
      // the leaf (open direction) is the drawn leaf: +y, in the normalized frame
      for (const d of [d0, d1, d2]) {
        expect(d.openAngle!).toBeCloseTo(Math.PI / 2, 6);
        expect(d.width).toBeCloseTo(H, 9);
      }
      // a blocked arc is exactly the no-arc result for the same door
      const plain = find(parseDxf(dxf(noArc, deg * D)).geometry, "door-0");
      for (const k of [
        "x",
        "y",
        "angle",
        "hingeX",
        "hingeY",
        "openAngle",
      ] as const)
        expect(d0[k]!, k).toBeCloseTo(plain[k]!, 6);
    });
  }

  it("a reversed wall (first-in-source-order host) keeps the Stage 3b-0 behaviour under rotation: the no-arc door follows the first wall's drawn direction", () => {
    const rev = (e: Ent[]) =>
      e.map((x) =>
        x.k === "line" && x.layer === "WALLS" && x.a[1] === 0 && x.b[1] === 0
          ? { ...x, a: x.b, b: x.a }
          : x,
      );
    for (const deg of [0, 27, -38]) {
      const g = parseDxf(dxf(rev(house), deg * D)).geometry;
      // the bottom wall now runs 30 -> 0, so the default side is -x: 25 - 1.5
      expect(find(g, "door-2").x!).toBeCloseTo(23.5, 6);
    }
  });
});

describe("both modes pass through the one normalization stage", () => {
  it("Mode A and Mode B rotate by the same applied angle for the same rotation", () => {
    for (const deg of [-17, 9, 40]) {
      const a = parseDxf(dxf(MODE_A, deg * D)).meta.rotationRad!;
      const b = parseDxf(dxf(MODE_B, deg * D)).meta.rotationRad!;
      expect(a).toBeCloseTo(-deg * D, 9);
      expect(b).toBeCloseTo(-deg * D, 9);
    }
  });
});

describe("no confident orientation: the drawing is left as drawn", () => {
  it("too few wall segments: not rotated, no warning", () => {
    const r = parseDxf(
      dxf(
        [wl([0, 0], [30, 0]), wl([30, 0], [30, 20]), wl([30, 20], [0, 20])],
        20 * D,
      ),
    );
    expect(r.meta.rotationRad).toBe(0);
    expect(r.meta.warnings.some((w) => /ROTATION/.test(w.code))).toBe(false);
  });
  it("parallel walls only on a rotated drawing: not rotated, and a ROTATION_UNCERTAIN warning explains why", () => {
    const r = parseDxf(
      dxf(
        [0, 5, 10, 15].map((y) => wl([0, y], [30, y])),
        20 * D,
      ),
    );
    expect(r.meta.rotationRad).toBe(0);
    const w = r.meta.warnings.find((x) => x.code === "ROTATION_UNCERTAIN");
    expect(w?.severity).toBe("warning");
    expect(w?.message).toMatch(/perpendicular/);
  });
  it("an axis-aligned plan with the same content gets no rotation warning at all", () => {
    const r = parseDxf(dxf(MODE_B));
    expect(r.meta.warnings.filter((w) => /ROTATION/.test(w.code))).toEqual([]);
  });
  it("a plan with no wall layer at all: not rotated, no warning", () => {
    const r = parseDxf(
      dxf(
        [text([1, 1], "x"), { k: "line", layer: "GRID", a: [0, 0], b: [5, 7] }],
        20 * D,
      ),
    );
    expect(r.meta.rotationRad).toBe(0);
  });
});

describe("plan shapes through the full pipeline", () => {
  const shapes: [string, P[]][] = [
    [
      "L",
      [
        [0, 0],
        [30, 0],
        [30, 10],
        [15, 10],
        [15, 20],
        [0, 20],
      ],
    ],
    [
      "U",
      [
        [0, 0],
        [30, 0],
        [30, 20],
        [20, 20],
        [20, 8],
        [10, 8],
        [10, 20],
        [0, 20],
      ],
    ],
    [
      "multi-wing",
      [
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
      ],
    ],
    ["long narrow", R(0, 0, 100, 3)],
  ];
  for (const [name, pts] of shapes)
    for (const deg of [-38, 7, 26]) {
      it(`${name}, Mode A, ${deg} degrees`, () => {
        const ents = [
          poly(pts),
          door([pts[0][0] + 2, pts[0][1]], [pts[0][0] + 4, pts[0][1]]),
        ];
        const a = parseDxf(dxf(ents));
        const r = parseDxf(dxf(ents, deg * D));
        expect(r.meta.rotationRad).toBeCloseTo(-deg * D, 9);
        expectSame(r.geometry, a.geometry);
      });
      it(`${name}, Mode B, ${deg} degrees`, () => {
        const ents = [
          ...pts.map((p, i) => wl(p, pts[(i + 1) % pts.length])),
          win([pts[0][0] + 2, pts[0][1]], [pts[0][0] + 4, pts[0][1]]),
        ];
        const a = parseDxf(dxf(ents));
        const r = parseDxf(dxf(ents, deg * D));
        expect(r.meta.rotationRad).toBeCloseTo(-deg * D, 9);
        expectSame(r.geometry, a.geometry);
      });
    }

  it("a plan with an internal diagonal wall (Mode B) rotates by the orthogonal family, not the diagonal", () => {
    const ents = [...outline(0, 0, 30, 20), wl([4, 4], [12, 11])];
    const r = parseDxf(dxf(ents, 14 * D));
    expect(r.meta.rotationRad).toBeCloseTo(-14 * D, 6);
  });
  it("duplicate shared-wall edges (Mode A) do not skew the rotation", () => {
    const ents = [
      poly(R(0, 0, 15, 12)),
      poly(R(15, 0, 30, 12)),
      poly(R(30, 0, 45, 12)),
      poly(R(15, 12, 45, 24)),
    ];
    const r = parseDxf(dxf(ents, -23 * D));
    expect(r.meta.rotationRad).toBeCloseTo(23 * D, 9);
  });
});
