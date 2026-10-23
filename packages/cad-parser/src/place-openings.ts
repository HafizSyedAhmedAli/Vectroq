// packages/cad-parser/src/place-openings.ts
import type { Wall } from "@vectroq/shared-types";
import type { Point2D } from "./polygon";

export interface Placement {
  x?: number;
  y?: number;
  angle?: number;
  /** Set for doors drawn as a swung leaf. */
  hingeX?: number;
  hingeY?: number;
  openAngle?: number;
}

function nearestOnWalls(p: Point2D, walls: Wall[]) {
  let best: { wall: Wall; px: number; py: number; dist: number } | null = null;
  for (const w of walls) {
    const dx = w.endX - w.startX;
    const dy = w.endY - w.startY;
    const l2 = dx * dx + dy * dy;
    if (!l2) continue;
    const t = Math.max(
      0,
      Math.min(1, ((p.x - w.startX) * dx + (p.y - w.startY) * dy) / l2),
    );
    const px = w.startX + t * dx;
    const py = w.startY + t * dy;
    const dist = Math.hypot(p.x - px, p.y - py);
    if (!best || dist < best.dist) best = { wall: w, px, py, dist };
  }
  return best;
}

function pointSegDist(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (!l2) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2),
  );
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** True when a wall starts or ends in the middle of the span (a junction). */
function spanBlocked(from: Point2D, to: Point2D, walls: Wall[]): boolean {
  const EDGE = 0.25; // ft
  for (const w of walls) {
    for (const p of [
      { x: w.startX, y: w.startY },
      { x: w.endX, y: w.endY },
    ]) {
      if (Math.hypot(p.x - from.x, p.y - from.y) < EDGE) continue;
      if (Math.hypot(p.x - to.x, p.y - to.y) < EDGE) continue;
      if (pointSegDist(p, from, to) < EDGE) return true;
    }
  }
  return false;
}

/**
 * Places an opening drawn as a LINE onto the closest wall.
 * - Window / flat door line lying on the wall: centre = its midpoint on the wall.
 * - Door drawn as a swung leaf (hinge on the wall, line sticking out):
 *   the endpoint touching the wall is the hinge. The door runs half a width
 *   along the wall from it: along the wall's direction by default, or the way
 *   the door's arc says (`closedAngle`) when that does not cross a wall junction.
 *   The hinge and the leaf's open direction are returned for the 3D view.
 */
export function snapToWall(
  a: Point2D,
  b: Point2D,
  walls: Wall[],
  closedAngle?: number,
): Placement {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const width = Math.hypot(b.x - a.x, b.y - a.y);

  const candidates = [mid, a, b]
    .map((p, i) => ({ i, hit: nearestOnWalls(p, walls) }))
    .filter((c) => c.hit !== null) as {
    i: number;
    hit: NonNullable<ReturnType<typeof nearestOnWalls>>;
  }[];
  if (candidates.length === 0) return {};

  // strict "<" keeps the midpoint on ties (windows lie on the wall)
  const best = candidates.reduce((m, c) => (c.hit.dist < m.hit.dist ? c : m));
  const { wall, px, py } = best.hit;
  const angle = Math.atan2(wall.endY - wall.startY, wall.endX - wall.startX);

  if (best.i === 0) return { x: px, y: py, angle };

  const hinge = best.i === 1 ? a : b;
  const tip = best.i === 1 ? b : a;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);

  let s = 1;
  if (closedAngle !== undefined) {
    const want = Math.cos(closedAngle - angle) >= 0 ? 1 : -1;
    const end = { x: px + want * ux * width, y: py + want * uy * width };
    if (!spanBlocked({ x: px, y: py }, end, walls)) s = want;
  }

  return {
    x: px + (s * ux * width) / 2,
    y: py + (s * uy * width) / 2,
    angle,
    hingeX: px,
    hingeY: py,
    openAngle: Math.atan2(tip.y - hinge.y, tip.x - hinge.x),
  };
}
