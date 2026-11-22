// Phase 2, Stage 3b-0: pipeline regression for deterministic opening snapping.
//  - the eight approved window corrections (and nothing else) on the fixtures
//  - Mode B entity-order and Mode A outline-order / winding / start-vertex
//    transformations do not change where openings land
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import DxfParser from "dxf-parser";
import type { Geometry } from "@vectroq/shared-types";
import { dxfToGeometry } from "./dxf-to-geometry";
import { parseDxf } from "./parse-dxf";
import { normalizeModeBSegments } from "./mode-b-walls";
import { FIXTURES } from "../eval/fixtures";

const text = (name: string) => {
  const f = FIXTURES.find((x) => x.name === name);
  if (!f) throw new Error(`fixture ${name} missing`);
  return readFileSync(f.path, "utf8");
};

// ------------------------------------------------ the eight approved corrections
// [fixture, opening id, coordinate, value before Stage 3b-0 (wrong), value now (drawn midpoint)]
const CORRECTIONS: [string, string, "x" | "y", number, number][] = [
  ["whole_house_simple_plan", "window-1", "x", 28.379266, 25.42651],
  ["whole_house_simple_plan", "window-5", "y", 16.4042, 21.653544],
  ["whole_house_simple_plan", "window-6", "y", 13.779528, 7.217848],
  ["whole_house_connected", "window-4", "y", 1.64042, 8.2021],
  ["whole_house_connected", "window-5", "y", 13.779528, 7.217848],
  ["web-sample-house-plan", "window-1", "x", 28.379266, 25.42651],
  ["web-sample-house-plan", "window-5", "y", 16.4042, 21.653544],
  ["web-sample-house-plan", "window-6", "y", 13.779528, 7.217848],
];

describe("Stage 3b-0: the eight approved window corrections", () => {
  for (const [fx, id, k, wrong, right] of CORRECTIONS)
    it(`${fx} ${id}.${k} is the drawn midpoint, not the displaced value`, () => {
      const o = parseDxf(text(fx)).geometry.openings.find((x) => x.id === id)!;
      expect(o[k]).toBeCloseTo(right, 5);
      expect(Math.abs(o[k]! - wrong)).toBeGreaterThan(1);
    });

  // Physical check: every window line in these drawings lies on a wall, so the
  // placed opening must sit at the midpoint of its own line, to float precision.
  for (const fx of [
    "whole_house_simple_plan",
    "whole_house_connected",
    "web-sample-house-plan",
  ])
    it(`${fx}: every window sits at the midpoint of its drawn line`, () => {
      const t = text(fx);
      const r = parseDxf(t);
      const k = r.meta.unit?.feetPerUnit ?? 1;
      const lines = (new DxfParser().parseSync(t)!.entities as any[]).filter(
        (e) => e.type === "LINE" && /^windows?$/i.test(e.layer ?? ""),
      );
      const wins = r.geometry.openings.filter((o) => o.type === "window");
      expect(wins).toHaveLength(lines.length);
      lines.forEach((l, i) => {
        const [a, b] = l.vertices;
        const o = wins[i];
        expect(o.id).toBe(`window-${i}`);
        expect(o.x!).toBeCloseTo(((a.x + b.x) / 2) * k, 6);
        expect(o.y!).toBeCloseTo(((a.y + b.y) / 2) * k, 6);
      });
    });

  it("sample-house (Mode A) openings are untouched", () => {
    const g = parseDxf(text("sample-house")).geometry;
    expect(g.walls).toHaveLength(10);
    expect(g.rooms).toHaveLength(3);
  });
});

// ------------------------------------------------ transformations of the input
type Ent = any;
const entitiesOf = (name: string): Ent[] =>
  (new DxfParser().parseSync(text(name))!.entities as Ent[]).map((e) =>
    e.type === "MTEXT"
      ? {
          ...e,
          type: "TEXT",
          startPoint: e.position,
          text: String(e.text ?? ""),
        }
      : e,
  );
const run = (entities: Ent[]): Geometry =>
  dxfToGeometry({ entities } as never, undefined, { unitTrusted: true });

const r6 = (n: number | undefined) =>
  n === undefined ? "-" : (Math.round(n * 1e6) / 1e6 + 0).toFixed(6);
const modPi = (a: number) => {
  const r = ((a % Math.PI) + Math.PI) % Math.PI;
  return r > Math.PI - 1e-9 ? 0 : r;
};
/** where openings land, ignoring ids, order and the drawn direction of the host */
const placement = (g: Geometry) =>
  g.openings
    .map((o) =>
      [
        o.type,
        r6(o.x),
        r6(o.y),
        r6(o.width),
        r6(o.hingeX),
        r6(o.hingeY),
        r6(o.openAngle === undefined ? undefined : modPi(o.openAngle)),
        r6(modPi(o.angle!)),
      ].join("|"),
    )
    .sort();
const wallSet = (g: Geometry) =>
  g.walls
    .map((w) => {
      const p = [
        [r6(w.startX), r6(w.startY)],
        [r6(w.endX), r6(w.endY)],
      ].sort((a, b) =>
        a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1,
      );
      return p.join(">");
    })
    .sort();
const roomAreas = (g: Geometry) => g.rooms.map((r) => r6(r.area)).sort();

/** deterministic Fisher-Yates */
const shuffle = <T>(a: T[], seed: number): T[] => {
  const out = [...a];
  let s = seed >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

describe("Mode B: entity-order transformations", () => {
  for (const fx of ["whole_house_simple_plan", "whole_house_connected"]) {
    const ents = entitiesOf(fx);
    const ref = run(ents);
    const orders: [string, Ent[]][] = [
      ["reversed", [...ents].reverse()],
      ...[1, 2, 3, 4, 5].map(
        (s) => [`shuffle ${s}`, shuffle(ents, s)] as [string, Ent[]],
      ),
    ];
    for (const [n, e] of orders)
      it(`${fx}, ${n}: openings, walls and rooms land identically`, () => {
        const g = run(e);
        expect(placement(g)).toEqual(placement(ref));
        expect(wallSet(g)).toEqual(wallSet(ref));
        expect(roomAreas(g)).toEqual(roomAreas(ref));
        expect(g.openings).toHaveLength(ref.openings.length);
      });
  }
});

describe("Mode A: outline order, winding and start vertex", () => {
  const ents = entitiesOf("sample-house");
  const isWallPoly = (e: Ent) =>
    e.type === "LWPOLYLINE" && /^walls?$/i.test(e.layer ?? "");
  const map = (f: (e: Ent) => Ent) =>
    ents.map((e) => (isWallPoly(e) ? f(e) : e));
  const ref = run(ents);

  // Placement is compared mod pi: which polygon's wall comes first decides the
  // drawn direction of a shared host, and so the sign of `angle` (documented).
  const cases: [string, Ent[]][] = [
    ["entity order reversed", [...ents].reverse(), true],
    [
      "outlines reordered",
      (() => {
        const polys = ents.filter(isWallPoly).reverse();
        let i = 0;
        return ents.map((e) => (isWallPoly(e) ? polys[i++] : e));
      })(),
    ],
    [
      "start vertex rotated",
      map((e) => ({ ...e, vertices: [...e.vertices.slice(1), e.vertices[0]] })),
    ],
    [
      "winding reversed",
      map((e) => ({ ...e, vertices: [...e.vertices].reverse() })),
    ],
    [
      "winding reversed + start rotated + entity order reversed",
      [
        ...map((e) => ({
          ...e,
          vertices: [...e.vertices.slice(1), e.vertices[0]].reverse(),
        })),
      ].reverse(),
    ],
  ];
  for (const [n, e] of cases)
    it(`${n}: openings land identically and wall/room totals are unchanged`, () => {
      const g = run(e);
      expect(placement(g)).toEqual(placement(ref));
      expect(g.walls).toHaveLength(ref.walls.length);
      expect(roomAreas(g)).toEqual(roomAreas(ref));
      expect(r6(g.walls.reduce((s, w) => s + w.length, 0))).toEqual(
        r6(ref.walls.reduce((s, w) => s + w.length, 0)),
      );
    });
});

// ------------------------------------------- shared-wall door semantics (legacy)
const rectV = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
  { x: x0, y: y0 },
];
const poly = (v: { x: number; y: number }[]) => ({
  type: "LWPOLYLINE",
  layer: "WALLS",
  vertices: v,
});
const ln = (layer: string, a: number[], b: number[]) => ({
  type: "LINE",
  layer,
  vertices: [
    { x: a[0], y: a[1] },
    { x: b[0], y: b[1] },
  ],
});
const door = (g: Geometry, i = 0) =>
  g.openings.filter((o) => o.type === "door")[i];

describe("Mode A: a shared no-arc door follows the FIRST polygon's wall direction", () => {
  const r1 = rectV(0, 0, 10, 8);
  const r2 = rectV(10, 0, 20, 12);
  const dl = ln("DOORS", [10, 3], [13, 3]); // hinge-style, no arc, on the shared run
  it("room 1 first: centre on the +y side, angle +pi/2", () => {
    const d = door(run([poly(r1), poly(r2), dl]));
    expect([d.x, d.y]).toEqual([10, 4.5]);
    expect(d.angle).toBeCloseTo(Math.PI / 2, 9);
    expect([d.hingeX, d.hingeY]).toEqual([10, 3]);
  });
  it("room 2 first: centre on the -y side, angle -pi/2; hinge unchanged", () => {
    const d = door(run([poly(r2), poly(r1), dl]));
    expect([d.x, d.y]).toEqual([10, 1.5]);
    expect(d.angle).toBeCloseTo(-Math.PI / 2, 9);
    expect([d.hingeX, d.hingeY]).toEqual([10, 3]);
  });
  it("hinge and leaf are the same in both orders", () => {
    const a = door(run([poly(r1), poly(r2), dl]));
    const b = door(run([poly(r2), poly(r1), dl]));
    expect([b.hingeX, b.hingeY, b.openAngle, b.width]).toEqual([
      a.hingeX,
      a.hingeY,
      a.openAngle,
      a.width,
    ]);
  });
});

describe("Mode B: first LINE wins on opposite-direction shared hosts", () => {
  const up = ln("WALLS", [10, 0], [10, 8]);
  const down = ln("WALLS", [10, 12], [10, 2]); // partial overlap, opposite way
  const dl = ln("DOORS", [10, 5], [13, 5]);
  it("partial overlap, up first: centre y 6.5, angle +pi/2", () => {
    const d = door(run([up, down, dl]));
    expect(d.y!).toBeCloseTo(6.5, 9);
    expect(d.angle).toBeCloseTo(Math.PI / 2, 9);
  });
  it("partial overlap, down first: centre y 3.5, angle -pi/2", () => {
    const d = door(run([down, up, dl]));
    expect(d.y!).toBeCloseTo(3.5, 9);
    expect(d.angle).toBeCloseTo(-Math.PI / 2, 9);
  });
  it("the hinge is the same in both orders", () => {
    const a = door(run([up, down, dl]));
    const b = door(run([down, up, dl]));
    expect([b.hingeX, b.hingeY, b.openAngle]).toEqual([
      a.hingeX,
      a.hingeY,
      a.openAngle,
    ]);
  });
});

describe("Mode B: reversed exact duplicates keep the first LINE (dedupeSegments)", () => {
  const fwd = ln("WALLS", [10, 0], [10, 8]);
  const rev = ln("WALLS", [10, 8], [10, 0]);
  const seg = (e: any) => ({
    x1: e.vertices[0].x,
    y1: e.vertices[0].y,
    x2: e.vertices[1].x,
    y2: e.vertices[1].y,
  });
  it("dedupeSegments retains the first of the pair, with its direction", () => {
    for (const [first, second] of [
      [fwd, rev],
      [rev, fwd],
    ]) {
      const { legacySegs } = normalizeModeBSegments([seg(first), seg(second)], {
        merge: false,
      });
      expect(legacySegs).toEqual([seg(first)]);
    }
  });
  const dl = ln("DOORS", [10, 3], [13, 3]);
  it("forward line first: door centre on +y; reversed line first: -y", () => {
    const a = door(run([fwd, rev, dl]));
    const b = door(run([rev, fwd, dl]));
    expect(a.y!).toBeCloseTo(4.5, 9);
    expect(a.angle).toBeCloseTo(Math.PI / 2, 9);
    expect(b.y!).toBeCloseTo(1.5, 9);
    expect(b.angle).toBeCloseTo(-Math.PI / 2, 9);
  });
});
