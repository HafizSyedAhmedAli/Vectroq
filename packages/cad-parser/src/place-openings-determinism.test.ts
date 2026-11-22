// Phase 2, Stage 3b-0: snapToWall determinism and floating-point stability.
//
// Contract under test (see the table in the doc comment on snapToWall):
//  - Float noise never changes the result; swapping the opening's a/b never
//    changes candidate selection.
//  - Same-direction duplicate hosts are array-order independent.
//  - Opposite-direction coincident hosts and distinct equidistant hosts: the
//    FIRST host in source order wins (the original tie semantics, kept).
//  - No-arc and blocked-arc doors take the selected host's drawn direction.
//  - Hinge, leaf, flat-opening position and arc-informed unblocked position do
//    not depend on array order or wall direction. Complete array-order
//    independence is NOT claimed for opposite-direction coincident hosts.
import { describe, expect, it } from "vitest";
import type { Wall } from "@vectroq/shared-types";
import { snapToWall, type Placement } from "./place-openings";

type P = { x: number; y: number };

const wall = (sx: number, sy: number, ex: number, ey: number): Wall => ({
  id: "w",
  startX: sx,
  startY: sy,
  endX: ex,
  endY: ey,
  length: Math.hypot(ex - sx, ey - sy),
  height: 10,
  thickness: 0.75,
});
const rev = (w: Wall): Wall => ({
  ...w,
  startX: w.endX,
  startY: w.endY,
  endX: w.startX,
  endY: w.startY,
});
const shift = (w: Wall, ox: number, oy: number): Wall => ({
  ...w,
  startX: w.startX + ox,
  startY: w.startY + oy,
  endX: w.endX + ox,
  endY: w.endY + oy,
});
const sp = (p: P, ox: number, oy: number): P => ({ x: p.x + ox, y: p.y + oy });

function perms<T>(a: T[]): T[][] {
  if (a.length <= 1) return [a];
  return a.flatMap((x, i) =>
    perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p]),
  );
}
/** every endpoint-reversal mask of the walls (array order kept) */
const reversals = (ws: Wall[]): Wall[][] =>
  Array.from({ length: 1 << ws.length }, (_, m) =>
    ws.map((w, i) => ((m >> i) & 1 ? rev(w) : w)),
  );

const rot = (p: P, a: number): P => ({
  x: p.x * Math.cos(a) - p.y * Math.sin(a),
  y: p.x * Math.sin(a) + p.y * Math.cos(a),
});
const roundTrip = (p: P, a: number): P => rot(rot(p, a), -a);
const rtWall = (w: Wall, a: number): Wall => {
  const s = roundTrip({ x: w.startX, y: w.startY }, a);
  const e = roundTrip({ x: w.endX, y: w.endY }, a);
  return { ...w, startX: s.x, startY: s.y, endX: e.x, endY: e.y };
};

const modPi = (a: number) => {
  const r = ((a % Math.PI) + Math.PI) % Math.PI;
  return r > Math.PI - 1e-9 ? 0 : r;
};
/** position + hinge + leaf: everything that must not depend on wall direction */
const geo = (r: Placement) => ({
  x: r.x,
  y: r.y,
  hingeX: r.hingeX,
  hingeY: r.hingeY,
  openAngle: r.openAngle,
});
const close = (a: Placement, b: Placement, tol = 1e-9) => {
  for (const k of ["x", "y", "hingeX", "hingeY"] as const) {
    if ((a[k] === undefined) !== (b[k] === undefined)) return false;
    if (a[k] !== undefined && Math.abs(a[k]! - b[k]!) > tol) return false;
  }
  return true;
};

const EPS = Number.EPSILON;
const maxAbs = (ps: number[]) => Math.max(...ps.map(Math.abs));

// ------------------------------------------------------------ floating point
describe("snapToWall: floating-point stability", () => {
  const OFFSETS = [
    0, 1e3, -1e3, 1e5, -1e5, 1e6, -1e6, 1e7, -1e7, 1e8, -1e8, 1e9, -1e9,
  ];
  const ANGLES = [0.01, 17, 45, -30, 100, 179.9].map(
    (d) => (d * Math.PI) / 180,
  );
  // a 40 x 30 box of walls plus windows lying exactly on them
  const box = [
    wall(0, 0, 40, 0),
    wall(40, 0, 40, 30),
    wall(40, 30, 0, 30),
    wall(0, 30, 0, 0),
  ];
  const windows: [P, P][] = [
    [
      { x: 4, y: 0 },
      { x: 10.5, y: 0 },
    ],
    [
      { x: 26, y: 0 },
      { x: 29, y: 0 },
    ],
    [
      { x: 40, y: 12 },
      { x: 40, y: 18 },
    ],
    [
      { x: 30, y: 30 },
      { x: 21, y: 30 },
    ],
    [
      { x: 0, y: 5 },
      { x: 0, y: 9.5 },
    ],
  ];

  for (const off of OFFSETS) {
    it(`windows on walls stay at their drawn midpoint (offset ${off}), forward/reversed arrays, rotation round trips`, () => {
      const oy = off * 0.7;
      for (const phi of [0, ...ANGLES]) {
        const ws = box.map((w) => rtWall(shift(w, off, oy), phi));
        const M = maxAbs(
          ws.flatMap((w) => [w.startX, w.startY, w.endX, w.endY]),
        );
        const tol = 1e-6 + 64 * EPS * M;
        for (const arr of [ws, [...ws].reverse()]) {
          for (const [a0, b0] of windows) {
            const a = roundTrip(sp(a0, off, oy), phi);
            const b = roundTrip(sp(b0, off, oy), phi);
            const r = snapToWall(a, b, arr);
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            expect(r.hingeX, "no endpoint (swung-door) path").toBeUndefined();
            expect(Math.abs(r.x! - mid.x)).toBeLessThanOrEqual(tol);
            expect(Math.abs(r.y! - mid.y)).toBeLessThanOrEqual(tol);
          }
        }
      }
    });
  }

  for (const off of [0, 1e6]) {
    it(`genuine candidate differences around the epsilon boundary (offset ${off})`, () => {
      const w = shift(wall(0, 0, 20, 0), off, off);
      const a = { x: off + 2, y: off };
      const M = maxAbs([off + 20, off, off + 6]);
      const eps = 8 * EPS * M;
      // b is tilted away by d: dist(a)=0, dist(mid)=d/2, dist(b)=d
      const at = (d: number) => snapToWall(a, { x: off + 6, y: off + d }, [w]);

      // mid within eps of the minimum -> tied -> midpoint wins (flat opening)
      const tied = at(1.5 * eps);
      expect(tied.hingeX).toBeUndefined();
      expect(tied.x).toBeCloseTo(off + 4, 6);

      // mid genuinely farther than eps -> the endpoint on the wall wins
      const apart = at(4 * eps);
      expect(apart.hingeX).toBeDefined();
      expect(apart.hingeX!).toBeCloseTo(off + 2, 6);
    });
  }

  it("a clearly closer endpoint always wins (door leaf)", () => {
    const r = snapToWall({ x: 5, y: 0 }, { x: 5, y: 3 }, [wall(0, 0, 10, 0)]);
    expect(r.hingeX).toBeCloseTo(5);
    expect(r.x).toBeCloseTo(6.5);
  });

  it("midpoint wins when it ties both endpoints (flat window on the wall)", () => {
    const r = snapToWall({ x: 2, y: 0 }, { x: 6, y: 0 }, [wall(0, 0, 10, 0)]);
    expect(r.hingeX).toBeUndefined();
    expect(r.x).toBeCloseTo(4);
  });

  it("midpoint wins when all three candidates are equally far (line parallel to the wall)", () => {
    const r = snapToWall({ x: 2, y: 1 }, { x: 6, y: 1 }, [wall(0, 0, 10, 0)]);
    expect(r.hingeX).toBeUndefined();
    expect(r.x).toBeCloseTo(4);
    expect(r.y).toBeCloseTo(0);
  });
});

// ---------------------------------------------------------- host determinism
describe("snapToWall: host selection (first in source order wins ties)", () => {
  const A = { x: 4, y: 0 };
  const B = { x: 7, y: 0 };
  const run = (ws: Wall[], a: P, b: P, closed?: number) =>
    snapToWall(a, b, ws, closed);

  // ties between walls that are physically the same, or equally close
  type Sc = { name: string; walls: Wall[]; a: P; b: P; closed?: number };
  const tied: Sc[] = [
    {
      name: "coincident walls, opposite directions (shared Mode A edge)",
      walls: [wall(0, 0, 20, 0), wall(20, 0, 0, 0)],
      a: A,
      b: B,
    },
    {
      name: "partially coincident walls, opposite directions",
      walls: [wall(0, 0, 20, 0), wall(15, 0, 3, 0)],
      a: { x: 8, y: 0 },
      b: { x: 11, y: 0 },
    },
    {
      name: "multiple coincident walls (2 opposite + 1 same direction)",
      walls: [wall(0, 0, 20, 0), wall(20, 0, 0, 0), wall(0, 0, 20, 0)],
      a: A,
      b: B,
    },
    {
      name: "distinct equidistant walls: parallel pair 0.5 ft apart",
      walls: [wall(0, 0, 20, 0), wall(0, 0.5, 20, 0.5)],
      a: { x: 4, y: 0.25 },
      b: { x: 7, y: 0.25 },
    },
    {
      name: "distinct equidistant walls: L corner tie",
      walls: [wall(0, 0, 20, 0), wall(0, 0, 0, 20)],
      a: { x: 0.2, y: 0.2 },
      b: { x: 0.4, y: 0.4 },
    },
    {
      name: "door without arc on coincident opposite walls",
      walls: [wall(0, 0, 20, 0), wall(20, 0, 0, 0)],
      a: { x: 6, y: 0 },
      b: { x: 6, y: 3 },
    },
    {
      name: "door with arc on coincident opposite walls",
      walls: [wall(0, 0, 20, 0), wall(20, 0, 0, 0)],
      a: { x: 6, y: 0 },
      b: { x: 6, y: 3 },
      closed: Math.PI,
    },
  ];

  for (const sc of tied) {
    it(`${sc.name}: every array order gives exactly the result of its first wall`, () => {
      for (const ws of perms(sc.walls)) {
        // identical to snapping against the first wall alone: the first wins
        const alone = run([ws[0]], sc.a, sc.b, sc.closed);
        // (the first wall must be one of the tied ones for this to be a tie)
        expect(run(ws, sc.a, sc.b, sc.closed)).toEqual(alone);
      }
    });

    it(`${sc.name}: the first wall still wins after every reversal of the walls`, () => {
      for (const ws of reversals(sc.walls)) {
        const alone = run([ws[0]], sc.a, sc.b, sc.closed);
        expect(run(ws, sc.a, sc.b, sc.closed)).toEqual(alone);
      }
    });

    it(`${sc.name}: float noise and a 1e6 offset do not change the host or result for the same ordered input`, () => {
      const base = run(sc.walls, sc.a, sc.b, sc.closed);
      for (const k of [1, 2, 3, 4, 5, 6, 7]) {
        const phi = ((k * 11.3 + 0.37) * Math.PI) / 180;
        const a = roundTrip(sp(sc.a, 1e6, 7e5), phi);
        const b = roundTrip(sp(sc.b, 1e6, 7e5), phi);
        const ws = sc.walls.map((w) => rtWall(shift(w, 1e6, 7e5), phi));
        const o = run(ws, a, b, sc.closed);
        expect(Math.abs(o.x! - (base.x! + 1e6))).toBeLessThan(1e-4);
        expect(Math.abs(o.y! - (base.y! + 7e5))).toBeLessThan(1e-4);
        // same host => same drawn direction => same angle (not just mod pi)
        expect(Math.abs(o.angle! - base.angle!)).toBeLessThan(1e-6);
        expect(o.hingeX === undefined).toBe(base.hingeX === undefined);
      }
    });
  }

  it("opposite-direction coincident hosts: no-arc door follows the FIRST wall's drawn direction", () => {
    const up = wall(10, 0, 10, 8);
    const down = wall(10, 12, 10, 0);
    const a = { x: 10, y: 3 };
    const b = { x: 13, y: 3 };
    const first = run([up, down], a, b);
    const second = run([down, up], a, b);
    expect(first.y).toBeCloseTo(4.5); // along the first wall (up)
    expect(first.angle).toBeCloseTo(Math.PI / 2);
    expect(second.y).toBeCloseTo(1.5); // along the first wall (down)
    expect(second.angle).toBeCloseTo(-Math.PI / 2);
    // hinge and leaf do not depend on which host is first
    expect([second.hingeX, second.hingeY, second.openAngle]).toEqual([
      first.hingeX,
      first.hingeY,
      first.openAngle,
    ]);
  });

  it("opposite-direction coincident hosts: blocked-arc door follows the FIRST wall's drawn direction", () => {
    const up = wall(10, 0, 10, 8);
    const down = wall(10, 12, 10, 0);
    const cross = wall(9.9, 4.5, 6, 4.5); // ends inside the span the arc points to
    const a = { x: 10, y: 3 };
    const b = { x: 13, y: 3 };
    expect(run([up, down, cross], a, b, Math.PI / 2).y).toBeCloseTo(4.5);
    expect(run([down, up, cross], a, b, Math.PI / 2).y).toBeCloseTo(1.5);
  });

  it("opposite-direction coincident hosts: flat position and arc-informed position do not depend on order; only angle does", () => {
    const up = wall(10, 0, 10, 8);
    const down = wall(10, 12, 10, 0);
    const cases: [P, P, number | undefined][] = [
      [{ x: 10, y: 2 }, { x: 10, y: 5 }, undefined], // flat window
      [{ x: 10, y: 3 }, { x: 13, y: 3 }, Math.PI / 2], // arc says +y
      [{ x: 10, y: 3 }, { x: 13, y: 3 }, -Math.PI / 2], // arc says -y
    ];
    for (const [a, b, c] of cases) {
      const f = run([up, down], a, b, c);
      const g = run([down, up], a, b, c);
      expect(geo(g)).toEqual(geo(f));
      expect(modPi(g.angle!)).toBeCloseTo(modPi(f.angle!), 9);
      expect(Math.abs(Math.abs(g.angle! - f.angle!) - Math.PI)).toBeLessThan(
        1e-9,
      ); // the host differs, so the angle differs by pi
    }
  });

  it("same-direction duplicate hosts are array-order independent", () => {
    const dup = [wall(0, 0, 20, 0), wall(0, 0, 20, 0)];
    const partial = [wall(0, 0, 20, 0), wall(2, 0, 20, 0)];
    const triple = [wall(0, 0, 20, 0), wall(0, 0, 20, 0), wall(0, 0, 20, 0)];
    for (const ws of [dup, partial, triple]) {
      for (const [a, b, c] of [
        [A, B, undefined],
        [{ x: 6, y: 0 }, { x: 6, y: 3 }, undefined],
        [{ x: 6, y: 0 }, { x: 6, y: 3 }, Math.PI],
      ] as [P, P, number | undefined][]) {
        const outs = perms(ws).map((p) => run(p, a, b, c));
        for (const o of outs) expect(o).toEqual(outs[0]);
      }
    }
  });

  it("the nearest of parallel walls at different distances is always chosen", () => {
    const near = wall(0, 0, 20, 0);
    const far = wall(0, 0.5, 20, 0.5);
    const a = { x: 4, y: 0.1 };
    const b = { x: 7, y: 0.1 };
    for (const ws of perms([near, far])) {
      for (const m of reversals(ws)) {
        expect(run(m, a, b).y).toBeCloseTo(0, 9);
      }
    }
  });

  it("a wall that is genuinely closer (beyond eps) beats an earlier wall", () => {
    const farFirst = wall(0, 1e-3, 20, 1e-3);
    const near = wall(0, 0, 20, 0);
    const r = run([farFirst, near], { x: 4, y: 0 }, { x: 7, y: 0 });
    expect(r.y).toBeCloseTo(0, 9);
  });

  it("a wall within eps of the minimum counts as tied, so the earlier wall wins", () => {
    const off = 1e6;
    const eps = 8 * EPS * (off + 20);
    const first = shift(wall(0, 0, 20, 0), off, off);
    const second = shift(wall(0, 0, 20, 0), off, off + eps / 4); // a hair closer, within eps
    const a = { x: off + 4, y: off + eps / 4 };
    const b = { x: off + 7, y: off + eps / 4 };
    // `second` is genuinely (but only just) nearer; the tie rule picks `first`
    expect(run([first, second], a, b).angle).toBe(run([first], a, b).angle);
    expect(run([second, first], a, b)).toEqual(run([second], a, b));
  });
});

// ---------------------------------------------------- opening endpoint order
describe("snapToWall: opening endpoint determinism (a <-> b)", () => {
  const cases: { name: string; walls: Wall[]; a: P; b: P; closed?: number }[] =
    [
      {
        name: "flat window on a wall",
        walls: [wall(0, 0, 10, 0)],
        a: { x: 2, y: 0 },
        b: { x: 6, y: 0 },
      },
      {
        name: "swung door, no arc",
        walls: [wall(0, 0, 10, 0)],
        a: { x: 5, y: 0 },
        b: { x: 5, y: 3 },
      },
      {
        name: "swung door, arc says -x",
        walls: [wall(0, 0, 10, 0)],
        a: { x: 5, y: 0 },
        b: { x: 5, y: 3 },
        closed: Math.PI,
      },
      {
        name: "midpoint tied with endpoints (line parallel to the wall)",
        walls: [wall(0, 0, 10, 0)],
        a: { x: 2, y: 1 },
        b: { x: 6, y: 1 },
      },
      {
        name: "both endpoints tied, midpoint farther (two short walls)",
        walls: [wall(0, 0, 1, 0), wall(9, 0, 10, 0)],
        a: { x: 0.5, y: 0 },
        b: { x: 9.5, y: 0 },
      },
      {
        name: "both endpoints tied with a diagonal line at an L corner",
        walls: [wall(0, 0, 20, 0), wall(0, 0, 0, 20)],
        a: { x: 0.2, y: 0.2 },
        b: { x: 0.4, y: 0.4 },
      },
    ];
  for (const c of cases) {
    it(`${c.name}: swapping a and b does not change the result`, () => {
      for (const ws of perms(c.walls)) {
        const fwd = snapToWall(c.a, c.b, ws, c.closed);
        const bwd = snapToWall(c.b, c.a, ws, c.closed);
        expect(bwd).toEqual(fwd);
      }
    });
    it(`${c.name}: swapping a and b is stable under a 1e6 offset and rotation noise`, () => {
      for (const k of [1, 2, 3, 4]) {
        const phi = ((k * 23.1 + 0.37) * Math.PI) / 180;
        const a = roundTrip(sp(c.a, 1e6, 7e5), phi);
        const b = roundTrip(sp(c.b, 1e6, 7e5), phi);
        const ws = c.walls.map((w) => rtWall(shift(w, 1e6, 7e5), phi));
        expect(snapToWall(b, a, ws, c.closed)).toEqual(
          snapToWall(a, b, ws, c.closed),
        );
      }
    });
  }

  it("both endpoints tied: the lexicographically smaller endpoint is the hinge", () => {
    const c = cases[4];
    const r = snapToWall(c.a, c.b, c.walls);
    expect(r.hingeX).toBeCloseTo(0.5);
    expect(r.hingeY).toBeCloseTo(0);
  });
});

// -------------------------------------------------------------- door behaviour
describe("snapToWall: door behaviour is unchanged", () => {
  const bottom = wall(0, 0, 10, 0);
  const hinge = { x: 5, y: 0 };
  const tip = { x: 5, y: 3 };

  it("arc information (unblocked) decides the side", () => {
    expect(snapToWall(hinge, tip, [bottom], 0).x).toBeCloseTo(6.5);
    expect(snapToWall(hinge, tip, [bottom], Math.PI).x).toBeCloseTo(3.5);
  });

  it("hinge and leaf placement", () => {
    const r = snapToWall(hinge, tip, [bottom], Math.PI);
    expect(r.hingeX).toBeCloseTo(5);
    expect(r.hingeY).toBeCloseTo(0);
    expect(r.openAngle).toBeCloseTo(Math.PI / 2);
  });

  it("no arc: default side follows the drawn wall direction (existing semantics, pinned)", () => {
    expect(snapToWall(hinge, tip, [bottom]).x).toBeCloseTo(6.5);
    expect(snapToWall(hinge, tip, [rev(bottom)]).x).toBeCloseTo(3.5);
  });

  it("blocked arc: default side follows the drawn wall direction (existing semantics, pinned)", () => {
    const crossing = wall(3.5, 0, 3.5, 5); // ends inside the span the arc points to
    expect(snapToWall(hinge, tip, [bottom, crossing], Math.PI).x).toBeCloseTo(
      6.5,
    );
    expect(
      snapToWall(hinge, tip, [rev(bottom), crossing], Math.PI).x,
    ).toBeCloseTo(3.5);
  });

  it("angle is the drawn direction of the chosen wall and differs by pi under reversal (pinned)", () => {
    const f = snapToWall({ x: 2, y: 0 }, { x: 6, y: 0 }, [bottom]);
    const b = snapToWall({ x: 2, y: 0 }, { x: 6, y: 0 }, [rev(bottom)]);
    expect(f.angle).toBeCloseTo(0);
    expect(Math.abs(b.angle!)).toBeCloseTo(Math.PI);
    expect(modPi(b.angle!)).toBeCloseTo(modPi(f.angle!), 9);
    expect(geo(b)).toEqual(geo(f)); // position/hinge/leaf do not depend on direction
  });

  it("with an unblocked arc, wall reversal changes nothing but the angle", () => {
    const f = snapToWall(hinge, tip, [bottom], Math.PI);
    const b = snapToWall(hinge, tip, [rev(bottom)], Math.PI);
    expect(close(b, f)).toBe(true);
    expect(b.openAngle).toBeCloseTo(f.openAngle!);
  });

  it("hinge and leaf never depend on wall direction, even without an arc", () => {
    const f = snapToWall(hinge, tip, [bottom]);
    const b = snapToWall(hinge, tip, [rev(bottom)]);
    expect([b.hingeX, b.hingeY, b.openAngle]).toEqual([
      f.hingeX,
      f.hingeY,
      f.openAngle,
    ]);
  });
});
