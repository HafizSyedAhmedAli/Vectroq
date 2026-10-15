// packages/cad-parser/src/place-openings.ts
import type { Wall } from "@tmcc/shared-types";
import type { Point2D } from "./polygon";

export interface Placement {
  x?: number;
  y?: number;
  angle?: number;
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

/**
 * Places an opening drawn as a LINE onto the closest wall.
 * - Window / flat door line lying on the wall: centre = its midpoint on the wall.
 * - Door drawn as a swung leaf (hinge on the wall, line sticking out):
 *   the endpoint touching the wall is the hinge, so centre the door
 *   half a width along the wall from it.
 */
export function snapToWall(a: Point2D, b: Point2D, walls: Wall[]): Placement {
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
  return {
    x: px + (Math.cos(angle) * width) / 2,
    y: py + (Math.sin(angle) * width) / 2,
    angle,
  };
}