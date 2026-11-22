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

interface WallHit {
  wall: Wall;
  px: number;
  py: number;
  dist: number;
}

/**
 * Nearest wall to `p`. Walls whose distance is within `eps` of the single
 * global minimum are tied; the first of them in array (source) order wins, as
 * the original strict "<" scan did. `eps` only makes tie detection numerically
 * stable; the wall's own drawn direction is never altered or canonicalized.
 */
function nearestOnWalls(
  p: Point2D,
  walls: Wall[],
  eps: number,
): WallHit | null {
  const hits: WallHit[] = [];
  let dmin = Infinity;
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
    hits.push({ wall: w, px, py, dist });
    if (dist < dmin) dmin = dist;
  }
  if (hits.length === 0) return null;
  // lowest array index among the tied walls
  return hits.find((h) => h.dist <= dmin + eps) ?? null;
}

/**
 * Float-noise tolerance: 8 machine epsilons of the largest absolute coordinate
 * involved (opening endpoints and every wall endpoint). It only decides which
 * candidates count as tied; it never alters a coordinate.
 */
function snapEps(a: Point2D, b: Point2D, walls: Wall[]): number {
  let m = Math.max(Math.abs(a.x), Math.abs(a.y), Math.abs(b.x), Math.abs(b.y));
  for (const w of walls) {
    m = Math.max(
      m,
      Math.abs(w.startX),
      Math.abs(w.startY),
      Math.abs(w.endX),
      Math.abs(w.endY),
    );
  }
  return 8 * Number.EPSILON * m;
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
 *
 * Determinism contract (Stage 3b-0):
 *
 * | Situation                                   | Behaviour                              |
 * |---------------------------------------------|----------------------------------------|
 * | Floating-point noise                        | Does not change the result             |
 * | Swapping the opening's `a` and `b`          | Does not change candidate selection    |
 * | Same-direction duplicate hosts              | Array-order independent                |
 * | Opposite-direction coincident hosts         | First host in source order wins        |
 * | Distinct equidistant hosts                  | First host in source order wins        |
 * | No-arc / blocked-arc door default side      | Follows the selected host's drawn dir. |
 * | Mode B reversed exact duplicate LINEs       | First LINE kept by dedupeSegments      |
 *
 * Hinge, leaf direction, flat-opening position and the position of an
 * arc-informed, unblocked door do not depend on wall array order or direction.
 * `angle` is the selected host's drawn direction, so it differs by pi when a
 * different (opposite-direction) host is selected or the wall is reversed.
 * Complete array-order independence is NOT claimed for opposite-direction
 * coincident hosts: that would contradict the preserved legacy behaviour.
 */
export function snapToWall(
  a: Point2D,
  b: Point2D,
  walls: Wall[],
  closedAngle?: number,
): Placement {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const width = Math.hypot(b.x - a.x, b.y - a.y);

  const eps = snapEps(a, b, walls);

  // Fixed priority: midpoint first, then the endpoints in canonical
  // lexicographic order, so swapping `a` and `b` cannot change the choice.
  const aFirst = a.x < b.x || (a.x === b.x && a.y <= b.y);
  const ordered = aFirst
    ? [
        { p: mid, kind: "mid" as const },
        { p: a, kind: "a" as const },
        { p: b, kind: "b" as const },
      ]
    : [
        { p: mid, kind: "mid" as const },
        { p: b, kind: "b" as const },
        { p: a, kind: "a" as const },
      ];
  const candidates = ordered
    .map((c) => ({ ...c, hit: nearestOnWalls(c.p, walls, eps) }))
    .filter((c) => c.hit !== null) as {
    p: Point2D;
    kind: "mid" | "a" | "b";
    hit: WallHit;
  }[];
  if (candidates.length === 0) return {};

  // Set-based: every candidate within eps of the single global minimum is
  // tied; the first in priority order wins (windows lie on the wall, so the
  // midpoint wins ties).
  let dmin = Infinity;
  for (const c of candidates) if (c.hit.dist < dmin) dmin = c.hit.dist;
  const best = candidates.find((c) => c.hit.dist <= dmin + eps)!;
  const { wall, px, py } = best.hit;
  const angle = Math.atan2(wall.endY - wall.startY, wall.endX - wall.startX);

  if (best.kind === "mid") return { x: px, y: py, angle };

  const hinge = best.kind === "a" ? a : b;
  const tip = best.kind === "a" ? b : a;
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
