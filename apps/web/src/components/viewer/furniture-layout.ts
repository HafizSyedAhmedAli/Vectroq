import type { Geometry, Opening, Room } from "@vectroq/shared-types";

export type FurnitureKind =
  | "bed"
  | "wardrobe"
  | "sofa"
  | "coffeeTable"
  | "tvUnit"
  | "diningTable"
  | "chair"
  | "counter"
  | "toilet"
  | "basin"
  | "desk"
  | "bookshelf";

export type Side = "S" | "N" | "W" | "E"; // S = smallest CAD y

export interface Placed {
  kind: FurnitureKind;
  x: number; // centre, CAD feet
  y: number;
  facing: [number, number]; // unit vector in CAD space, pointing into the room
  w: number; // size across the facing direction
  d: number; // size along the facing direction
  side?: Side;
}

export interface Rect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

interface Pt {
  x: number;
  y: number;
}
interface BBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}
type Located = Opening & { x: number; y: number };
interface Ctx {
  placed: Rect[];
  doors: Located[];
  windows: Located[];
}
interface FitOpts {
  windows?: boolean;
  margin?: number;
}

const INSET = 0.7; // half a 9 in wall plus a small gap
const GAP = 0.4;
const FACE: Record<Side, [number, number]> = {
  S: [0, 1],
  N: [0, -1],
  W: [1, 0],
  E: [-1, 0],
};
const OPPOSITE: Record<Side, Side> = { S: "N", N: "S", W: "E", E: "W" };

export function roomBounds(room: Room): BBox | null {
  const pts = (room.shapes ?? []).flat();
  if (!pts.length) return null;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function polyArea(p: Pt[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

/** True when the room fills (almost) its bounding box. */
export function roomIsRectangular(room: Room): boolean {
  const bb = roomBounds(room);
  if (!bb) return false;
  const box = (bb.maxX - bb.minX) * (bb.maxY - bb.minY);
  const area = (room.shapes ?? []).reduce((s, p) => s + polyArea(p), 0);
  return box > 0 && area / box > 0.95;
}

function inPoly(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}
const inRoom = (p: Pt, room: Room) =>
  (room.shapes ?? []).some((s) => inPoly(p, s));

/** Axis-aligned footprint of a placed piece (facings are always axis-aligned). */
export function footprintOf(
  x: number,
  y: number,
  facing: [number, number],
  w: number,
  d: number,
): Rect {
  const alongY = Math.abs(facing[1]) > 0.5;
  const hx = (alongY ? w : d) / 2;
  const hy = (alongY ? d : w) / 2;
  return { x0: x - hx, x1: x + hx, y0: y - hy, y1: y + hy };
}

const overlaps = (a: Rect, b: Rect, m: number) =>
  a.x0 < b.x1 + m && a.x1 > b.x0 - m && a.y0 < b.y1 + m && a.y1 > b.y0 - m;

/** Distance from a point to a rectangle (0 when inside). */
export function gapToRect(r: Rect, p: Pt): number {
  const dx = Math.max(r.x0 - p.x, 0, p.x - r.x1);
  const dy = Math.max(r.y0 - p.y, 0, p.y - r.y1);
  return Math.hypot(dx, dy);
}

/** Clear space kept in front of / around a door so its leaf can swing. */
export const doorClearance = (o: Opening) => o.width * 0.9 + 0.3;

function fits(r: Rect, room: Room, ctx: Ctx, opts: FitOpts = {}): boolean {
  const pts: Pt[] = [
    { x: r.x0, y: r.y0 },
    { x: r.x1, y: r.y0 },
    { x: r.x1, y: r.y1 },
    { x: r.x0, y: r.y1 },
    { x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 },
  ];
  if (!pts.every((p) => inRoom(p, room))) return false;
  if (ctx.placed.some((o) => overlaps(r, o, opts.margin ?? GAP))) return false;
  if (ctx.doors.some((o) => gapToRect(r, o) < doorClearance(o))) return false;
  if (
    opts.windows &&
    ctx.windows.some((o) => gapToRect(r, o) < o.width / 2 + 0.3)
  )
    return false;
  return true;
}

function atWall(
  bb: BBox,
  side: Side,
  w: number,
  d: number,
  t: number,
): Pt | null {
  const lerp = (a: number, b: number) => a + (b - a) * t;
  if (side === "S" || side === "N") {
    const lo = bb.minX + INSET + w / 2;
    const hi = bb.maxX - INSET - w / 2;
    if (hi < lo) return null;
    return {
      x: lerp(lo, hi),
      y: side === "S" ? bb.minY + INSET + d / 2 : bb.maxY - INSET - d / 2,
    };
  }
  const lo = bb.minY + INSET + w / 2;
  const hi = bb.maxY - INSET - w / 2;
  if (hi < lo) return null;
  return {
    y: lerp(lo, hi),
    x: side === "W" ? bb.minX + INSET + d / 2 : bb.maxX - INSET - d / 2,
  };
}

interface Room3 {
  room: Room;
  bb: BBox;
  ctx: Ctx;
}

function tryAt(
  c: Room3,
  kind: FurnitureKind,
  x: number,
  y: number,
  facing: [number, number],
  w: number,
  d: number,
  opts?: FitOpts,
  side?: Side,
): Placed | null {
  const r = footprintOf(x, y, facing, w, d);
  if (!fits(r, c.room, c.ctx, opts)) return null;
  c.ctx.placed.push(r);
  return { kind, x, y, facing, w, d, side };
}

function tryWall(
  c: Room3,
  kind: FurnitureKind,
  w: number,
  d: number,
  sides: Side[],
  ts: number[],
  opts: FitOpts & { minFree?: number } = {},
): Placed | null {
  const W = c.bb.maxX - c.bb.minX;
  const H = c.bb.maxY - c.bb.minY;
  for (const side of sides) {
    const extent = side === "S" || side === "N" ? H : W;
    if (extent < d + (opts.minFree ?? 0)) continue;
    for (const t of ts) {
      const p = atWall(c.bb, side, w, d, t);
      if (!p) continue;
      const placed = tryAt(c, kind, p.x, p.y, FACE[side], w, d, opts, side);
      if (placed) return placed;
    }
  }
  return null;
}

const isLocated = (o: Opening): o is Located =>
  typeof o.x === "number" && typeof o.y === "number";

/**
 * Picks furniture for one room from its name and type. Purely illustrative:
 * nothing here feeds the BOQ. A piece is skipped when it would not fit, would
 * overlap another piece, or would block a door swing.
 */
export function layoutFurniture(room: Room, openings: Opening[]): Placed[] {
  const bb = roomBounds(room);
  if (!bb) return [];
  const located = openings.filter(isLocated);
  const ctx: Ctx = {
    placed: [],
    doors: located.filter((o) => o.type === "door"),
    windows: located.filter((o) => o.type === "window"),
  };
  const c: Room3 = { room, bb, ctx };
  const out: Placed[] = [];
  const add = (p: Placed | null) => {
    if (p) out.push(p);
    return p;
  };

  const W = bb.maxX - bb.minX;
  const H = bb.maxY - bb.minY;
  const wide = W >= H;
  const shortWallsFirst: Side[] = wide
    ? ["W", "E", "S", "N"]
    : ["S", "N", "W", "E"];
  const longWallsFirst: Side[] = wide
    ? ["S", "N", "W", "E"]
    : ["W", "E", "S", "N"];
  const ALL_T = [0.5, 0.15, 0.85];
  const name = room.name.toLowerCase();

  // Study is checked before bedroom so "Study" and "Bedroom Study" both get a desk.
  const isStudy = /study|office|library|workspace|\bwork\b/.test(name);
  const isBedroom = /bed|master|guest|kids?|nursery/.test(name);
  const isLiving = /living|lounge|drawing|sitting|family|\btv\b/.test(name);
  const isDining = /dining/.test(name);

  if (room.type === "bathroom") {
    add(tryWall(c, "toilet", 1.5, 2.3, longWallsFirst, ALL_T));
    add(tryWall(c, "basin", 1.8, 1.4, [...longWallsFirst].reverse(), ALL_T));
  } else if (room.type === "kitchen") {
    for (const L of [10, 8, 6, 4]) {
      if (
        add(
          tryWall(c, "counter", L, 2, longWallsFirst, [0.5, 0, 1], {
            minFree: 3,
          }),
        )
      )
        break;
    }
  } else if (isStudy) {
    const desk = add(
      tryWall(c, "desk", 5, 2.3, longWallsFirst, [0.5, 0.2, 0.8], {
        minFree: 5,
      }),
    );
    if (desk) {
      const [fx, fy] = desk.facing;
      const off = desk.d / 2 + 0.75;
      // chair sits in front of the desk, facing it
      add(
        tryAt(
          c,
          "chair",
          desk.x + fx * off,
          desk.y + fy * off,
          [-fx, -fy],
          1.4,
          1.4,
          { margin: 0 },
        ),
      );
    }
    add(
      tryWall(
        c,
        "bookshelf",
        4,
        1,
        [...longWallsFirst].reverse(),
        [0.5, 0, 1, 0.25, 0.75],
        { windows: true },
      ),
    );
  } else if (isBedroom) {
    const small = room.area < 110;
    add(
      tryWall(c, "bed", small ? 3.5 : 5.5, 6.5, shortWallsFirst, ALL_T, {
        minFree: 3,
      }),
    );
    add(
      tryWall(
        c,
        "wardrobe",
        small ? 4 : 5,
        2,
        [...longWallsFirst],
        [0.5, 0, 1, 0.25, 0.75],
        { windows: true },
      ),
    );
  } else if (isLiving) {
    const sw = room.area < 130 ? 5 : 6.5;
    const sofa = add(
      tryWall(c, "sofa", sw, 2.8, longWallsFirst, [0.5, 0.2, 0.8], {
        minFree: 7,
      }),
    );
    if (sofa?.side) {
      const [fx, fy] = sofa.facing;
      add(
        tryAt(
          c,
          "coffeeTable",
          sofa.x + fx * 3.1,
          sofa.y + fy * 3.1,
          sofa.facing,
          3,
          1.6,
          { margin: 0.2 },
        ),
      );
      add(
        tryWall(c, "tvUnit", 5, 1.3, [OPPOSITE[sofa.side]], [0.5], {
          windows: true,
        }),
      );
    }
  } else if (isDining) {
    let ctr: Pt = { x: (bb.minX + bb.maxX) / 2, y: (bb.minY + bb.maxY) / 2 };
    if (
      !inRoom(ctr, room) &&
      room.labelX !== undefined &&
      room.labelY !== undefined
    )
      ctr = { x: room.labelX, y: room.labelY };
    const alongX = wide;
    const facing: [number, number] = alongX ? [0, 1] : [1, 0];
    const setRect: Rect = alongX
      ? { x0: ctr.x - 2.75, x1: ctr.x + 2.75, y0: ctr.y - 2.6, y1: ctr.y + 2.6 }
      : {
          x0: ctr.x - 2.6,
          x1: ctr.x + 2.6,
          y0: ctr.y - 2.75,
          y1: ctr.y + 2.75,
        };
    if (fits(setRect, room, ctx)) {
      ctx.placed.push(setRect);
      out.push({
        kind: "diningTable",
        x: ctr.x,
        y: ctr.y,
        facing,
        w: 5.5,
        d: 3,
      });
      const chairs: [number, number, [number, number]][] = alongX
        ? [
            [ctr.x - 1.3, ctr.y + 1.9, [0, -1]],
            [ctr.x + 1.3, ctr.y + 1.9, [0, -1]],
            [ctr.x - 1.3, ctr.y - 1.9, [0, 1]],
            [ctr.x + 1.3, ctr.y - 1.9, [0, 1]],
          ]
        : [
            [ctr.x + 1.9, ctr.y - 1.3, [-1, 0]],
            [ctr.x + 1.9, ctr.y + 1.3, [-1, 0]],
            [ctr.x - 1.9, ctr.y - 1.3, [1, 0]],
            [ctr.x - 1.9, ctr.y + 1.3, [1, 0]],
          ];
      for (const [x, y, f] of chairs)
        out.push({ kind: "chair", x, y, facing: f, w: 1.4, d: 1.4 });
    } else {
      add(tryAt(c, "diningTable", ctr.x, ctr.y, facing, 5.5, 3));
    }
  }
  return out;
}

/** Footprints of every piece in the house (CAD feet), for walk-mode collisions. */
export function furnitureRects(g: Geometry): Rect[] {
  return g.rooms
    .flatMap((r) => layoutFurniture(r, g.openings))
    .map((p) => footprintOf(p.x, p.y, p.facing, p.w, p.d));
}
