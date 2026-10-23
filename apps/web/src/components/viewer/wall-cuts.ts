import type { Geometry, Wall } from "@vectroq/shared-types";

export const SILL_FT = 3;

/** A solid block of wall. u = distance along the wall from its start, y = height. */
export interface WallPiece {
  u0: number;
  u1: number;
  y0: number;
  y1: number;
}

export interface WallCut {
  openingId: string;
  type: "door" | "window";
  u0: number;
  u1: number;
  y0: number;
  y1: number;
  /** Swung doors: hinge is on the u0 jamb (true) or the u1 jamb (false). */
  hingeAtStart?: boolean;
  /** Swung doors: the leaf opens toward the wall's local +z (1) or -z (-1). */
  swingZ?: 1 | -1;
  /** An open passage: frame only, no door leaf. */
  archway?: boolean;
}

export interface WallPlan {
  wall: Wall;
  pieces: WallPiece[];
  cuts: WallCut[];
}

/** How far (ft) to pull a wall end back so it doesn't poke into an opening on a crossing wall. */
function endClearance(
  px: number,
  py: number,
  wallAngle: number,
  g: Geometry,
): number {
  for (const o of g.openings) {
    if (o.x === undefined || o.y === undefined || o.angle === undefined)
      continue;
    // only walls that cross the opening's own wall
    if (Math.abs(Math.sin(wallAngle - o.angle)) < 0.8) continue;
    const rx = px - o.x;
    const ry = py - o.y;
    const along = rx * Math.cos(o.angle) + ry * Math.sin(o.angle);
    const across = -rx * Math.sin(o.angle) + ry * Math.cos(o.angle);
    if (Math.abs(along) <= o.width / 2 + 0.1 && Math.abs(across) <= 0.6)
      return 0.6;
  }
  return 0;
}

export function planWalls(g: Geometry): WallPlan[] {
  const plans: WallPlan[] = [];

  for (const wall of g.walls) {
    const dx = wall.endX - wall.startX;
    const dy = wall.endY - wall.startY;
    const len = Math.hypot(dx, dy);
    if (len < 0.01) continue;
    const ux = dx / len;
    const uy = dy / len;
    const wallAngle = Math.atan2(dy, dx);
    const H = wall.height;
    const th = wall.thickness;

    const cuts: WallCut[] = [];
    for (const o of g.openings) {
      if (o.x === undefined || o.y === undefined || o.angle === undefined)
        continue;
      const rx = o.x - wall.startX;
      const ry = o.y - wall.startY;
      const along = rx * ux + ry * uy;
      const across = Math.abs(-rx * uy + ry * ux);
      // On this wall? Shared walls drawn twice get the same hole in both copies.
      if (across > th / 2 + 0.25) continue;
      if (Math.abs(Math.sin(o.angle - wallAngle)) > 0.2) continue;

      const u0 = Math.max(0, along - o.width / 2);
      const u1 = Math.min(len, along + o.width / 2);
      if (u1 - u0 < 0.5) continue;

      const y0 = o.type === "door" ? 0 : Math.min(SILL_FT, H - 1);
      const y1 = Math.min(y0 + o.height, H - 0.5);

      const cut: WallCut = {
        openingId: o.id,
        type: o.type,
        u0,
        u1,
        y0,
        y1,
      };

      if (o.archway) cut.archway = true;

      if (
        o.type === "door" &&
        o.hingeX !== undefined &&
        o.hingeY !== undefined &&
        o.openAngle !== undefined
      ) {
        const hingeU =
          (o.hingeX - wall.startX) * ux + (o.hingeY - wall.startY) * uy;
        cut.hingeAtStart = hingeU < along;
        // the wall group's local +z points along CAD (uy, -ux)
        cut.swingZ =
          Math.cos(o.openAngle) * uy - Math.sin(o.openAngle) * ux >= 0 ? 1 : -1;
      }
      cuts.push(cut);
    }
    cuts.sort((a, b) => a.u0 - b.u0);

    const startClear = endClearance(wall.startX, wall.startY, wallAngle, g);
    const endClear = endClearance(wall.endX, wall.endY, wallAngle, g);
    const endU = endClear > 0 ? len - endClear : len + th / 2;

    // Solid wall = everything outside the cuts, plus the bits above/below each cut.
    const pieces: WallPiece[] = [];
    // walls overshoot by half a thickness to close corners, unless they end in a door
    let cursor = startClear > 0 ? startClear : -th / 2;
    for (const c of cuts) {
      const s = Math.max(c.u0, cursor);
      if (s - cursor > 0.01) pieces.push({ u0: cursor, u1: s, y0: 0, y1: H });
      if (c.u1 - s > 0.01) {
        if (c.y0 > 0.01) pieces.push({ u0: s, u1: c.u1, y0: 0, y1: c.y0 });
        if (H - c.y1 > 0.01) pieces.push({ u0: s, u1: c.u1, y0: c.y1, y1: H });
      }
      cursor = Math.max(cursor, c.u1);
    }
    if (endU - cursor > 0.01)
      pieces.push({ u0: cursor, u1: endU, y0: 0, y1: H });

    plans.push({ wall, pieces, cuts });
  }
  return plans;
}
