// packages/cad-parser/src/mode-a-walls.ts
//
// Phase 2, Stage 2: builds the walls of a Mode A drawing (one closed WALLS
// polyline per room) so that every physical wall run is represented once
// (INV-2). A wall shared by two rooms is drawn by both polygons; the pure
// `mergeCollinear` (normalize-segments.ts) merges those duplicates.
//
// This module deliberately does NOT touch rooms. Rooms come from the original
// polygons in dxf-to-geometry.ts and never from the merged walls.
//
// What it adds on top of mergeCollinear:
//  - the interior side of every edge, derived from its polygon's winding
//    (counter-clockwise: interior on the left of each directed edge;
//    clockwise: on the right), so a shared partition (opposite sides) can be
//    told apart from duplicate/nested outlines (same side);
//  - a guard so edges of the SAME polygon are never merged with each other: a
//    group is dissolved when two of its members from one polygon overlap each
//    other along the wall line (a sliver outline whose opposite edges fall
//    within the tolerance). Members of one polygon that are merely disjoint
//    (for example the two arms of a U-shaped room on either side of a notch)
//    are allowed in the same group, because each is absorbed by the OTHER
//    polygon's wall that covers them and they are never merged with each other;
//  - polygons that are not simple (self-touching or self-crossing) or have no
//    area are left out of merging, because their interior side is not defined;
//  - surfacing every refusal as a parse warning instead of discarding it.

import type { Wall } from "@vectroq/shared-types";
import {
  mergeCollinear,
  type MergeInputSeg,
  type MergeRefusalReason,
} from "./normalize-segments";
import { distance, type Point2D } from "./polygon";
import type { ParseReport } from "./report";

export interface ModeAWallParams {
  height: number;
  /** Mode A gives every wall the exterior thickness; unchanged by this stage. */
  thickness: number;
}

/** Twice the signed area (shoelace). > 0 counter-clockwise, < 0 clockwise. */
export function signedArea2(v: readonly Point2D[]): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) {
    const a = v[i];
    const b = v[(i + 1) % v.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s;
}

/**
 * Side of each directed boundary edge on which the polygon's interior lies:
 * counter-clockwise -> "left", clockwise -> "right". Depends only on the
 * polygon's winding, never on an individual edge's direction. undefined for a
 * polygon with no area.
 */
export function interiorSide(
  v: readonly Point2D[],
): "left" | "right" | undefined {
  const a = signedArea2(v);
  if (!(Math.abs(a) > 1e-9)) return undefined;
  return a > 0 ? "left" : "right";
}

const orient = (a: Point2D, b: Point2D, c: Point2D) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

const onSegment = (a: Point2D, b: Point2D, p: Point2D) =>
  Math.min(a.x, b.x) <= p.x &&
  p.x <= Math.max(a.x, b.x) &&
  Math.min(a.y, b.y) <= p.y &&
  p.y <= Math.max(a.y, b.y);

/** Closed-segment intersection: crossing, touching and collinear overlap all count. */
function segmentsMeet(a: Point2D, b: Point2D, c: Point2D, d: Point2D): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (o1 * o2 < 0 && o3 * o4 < 0) return true;
  if (o1 === 0 && onSegment(a, b, c)) return true;
  if (o2 === 0 && onSegment(a, b, d)) return true;
  if (o3 === 0 && onSegment(c, d, a)) return true;
  if (o4 === 0 && onSegment(c, d, b)) return true;
  return false;
}

/**
 * True when no two non-adjacent edges meet and no edge doubles back on its
 * neighbour. Zero-length edges (the repeated closing vertex) are ignored.
 */
export function isSimplePolygon(v: readonly Point2D[]): boolean {
  const e: [Point2D, Point2D][] = [];
  for (let i = 0; i < v.length; i++) {
    const a = v[i];
    const b = v[(i + 1) % v.length];
    if (a.x !== b.x || a.y !== b.y) e.push([a, b]);
  }
  const m = e.length;
  if (m < 3) return false;
  for (let i = 0; i < m; i++) {
    const [a, b] = e[i];
    const [c, d] = e[(i + 1) % m];
    // adjacent edges share b === c; they must not fold back onto each other
    const cross = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
    const dot = (b.x - a.x) * (d.x - c.x) + (b.y - a.y) * (d.y - c.y);
    if (cross === 0 && dot < 0) return false;
    for (let j = i + 2; j < m; j++) {
      if (i === 0 && j === m - 1) continue; // adjacent through the wrap
      if (segmentsMeet(a, b, e[j][0], e[j][1])) return false;
    }
  }
  return true;
}

const REFUSAL_CODE: Record<MergeRefusalReason, string> = {
  SAME_SIDE_OVERLAP: "WALL_SAME_SIDE_OVERLAP",
  FACE_OFFSET: "WALL_FACE_OFFSET",
  ANGLE_AMBIGUOUS: "WALL_ANGLE_AMBIGUOUS",
  CONFLICT_IN_GROUP: "WALL_MERGE_CONFLICT",
  CHAIN_DRIFT: "WALL_MERGE_CONFLICT",
  LAYER_MISMATCH: "WALL_MERGE_CONFLICT",
  THICKNESS_MISMATCH: "WALL_MERGE_CONFLICT",
};

/** Cap so a pathological drawing cannot flood the report. */
const MAX_REFUSAL_WARNINGS = 25;

/** Overlap shorter than this (ft) along the wall line is treated as touching. */
const TOUCH_EPS = 1e-6;

/**
 * True when two edges of the same polygon overlap each other (by more than a
 * touch) along the merged wall's line. Projection uses the merged segment's
 * direction, which is the leader's line, the same axis Stage 1 compares on.
 */
function samePolygonOverlap(
  seg: { x1: number; y1: number; x2: number; y2: number },
  members: readonly Edge[],
): boolean {
  const ux = seg.x2 - seg.x1;
  const uy = seg.y2 - seg.y1;
  const n = Math.hypot(ux, uy) || 1;
  const iv = members.map((e) => {
    const t1 = ((e.a.x - seg.x1) * ux + (e.a.y - seg.y1) * uy) / n;
    const t2 = ((e.b.x - seg.x1) * ux + (e.b.y - seg.y1) * uy) / n;
    return { poly: e.poly, lo: Math.min(t1, t2), hi: Math.max(t1, t2) };
  });
  for (let i = 0; i < iv.length; i++)
    for (let j = i + 1; j < iv.length; j++)
      if (
        iv[i].poly === iv[j].poly &&
        Math.min(iv[i].hi, iv[j].hi) - Math.max(iv[i].lo, iv[j].lo) > TOUCH_EPS
      )
        return true;
  return false;
}

interface Edge {
  /** Index of the owning polygon. */
  poly: number;
  /** Vertex index of the edge's start, used in the wall id. */
  i: number;
  a: Point2D;
  b: Point2D;
}

/**
 * Builds Mode A walls from closed room outlines.
 *
 * Without merging this is exactly the previous behaviour: one wall per
 * non-degenerate polygon edge, id `wall-{polygon}-{edge}`, in polygon then edge
 * order. With merging, an edge that duplicates part of another polygon's edge
 * (same physical wall, opposite interior sides) is absorbed into one wall that
 * spans their union and keeps the first contributor's id and direction. Every
 * other wall is returned unchanged.
 */
export function buildModeAWalls(
  polygons: readonly (readonly Point2D[])[],
  p: ModeAWallParams,
  report?: ParseReport,
): Wall[] {
  const edges: Edge[] = [];
  const eligiblePoly: boolean[] = [];
  const sideOf = polygons.map((v) => interiorSide(v));
  polygons.forEach((v, poly) => {
    const eligible = sideOf[poly] !== undefined && isSimplePolygon(v);
    eligiblePoly.push(eligible);
    if (!eligible)
      report?.warning(
        "WALL_POLYGON_NOT_MERGED",
        `Room outline ${poly + 1} has no area or crosses/touches itself, so its walls were left exactly as drawn and not checked for shared walls.`,
        { kind: "room", id: `room-${poly}` },
      );
    for (let i = 0; i < v.length; i++) {
      const a = v[i];
      const b = v[(i + 1) % v.length];
      if (a.x === b.x && a.y === b.y) continue; // closing point repeats the first vertex
      edges.push({ poly, i, a, b });
    }
  });

  const wallOf = (id: string, a: Point2D, b: Point2D): Wall => ({
    id,
    startX: a.x,
    startY: a.y,
    endX: b.x,
    endY: b.y,
    length: distance(a, b),
    height: p.height,
    thickness: p.thickness,
  });
  const idOf = (e: Edge) => `wall-${e.poly}-${e.i}`;

  // Only edges of simple polygons with an interior are offered for merging.
  const eligible = edges
    .map((_, k) => k)
    .filter((k) => eligiblePoly[edges[k].poly]);
  const input: MergeInputSeg[] = eligible.map((k) => {
    const e = edges[k];
    return {
      id: idOf(e),
      x1: e.a.x,
      y1: e.a.y,
      x2: e.b.x,
      y2: e.b.y,
      thickness: p.thickness,
      side: sideOf[e.poly]!,
    };
  });

  const res = mergeCollinear(input);

  // Accept a merge unless two contributors from the same polygon overlap each other.
  const replacement = new Map<number, Wall>(); // global edge index of first contributor -> merged wall
  const absorbed = new Set<number>();
  let removedCount = 0;
  let removedLength = 0;
  for (const seg of res.segs) {
    if (seg.sourceIndices.length < 2) continue;
    const globals = seg.sourceIndices.map((li) => eligible[li]);
    if (
      samePolygonOverlap(
        seg,
        globals.map((g) => edges[g]),
      )
    ) {
      report?.warning(
        "WALL_SAME_POLYGON_OVERLAP",
        `Walls ${seg.sources.join(", ")} include two edges of one room outline that overlap each other, so none of them were merged.`,
        { kind: "wall", id: seg.id },
      );
      continue;
    }
    const merged = wallOf(
      seg.id,
      { x: seg.x1, y: seg.y1 },
      { x: seg.x2, y: seg.y2 },
    );
    const inputLength = globals.reduce(
      (s, g) => s + distance(edges[g].a, edges[g].b),
      0,
    );
    replacement.set(globals[0], merged);
    for (const g of globals.slice(1)) absorbed.add(g);
    removedCount += globals.length - 1;
    removedLength += inputLength - merged.length;
  }

  let shown = 0;
  let suppressed = 0;
  for (const r of res.refusals) {
    if (shown >= MAX_REFUSAL_WARNINGS) {
      suppressed++;
      continue;
    }
    shown++;
    report?.warning(
      REFUSAL_CODE[r.reason],
      `Walls ${r.aId} and ${r.bId} overlap but were not merged (${r.reason}: ${r.detail}).`,
      { kind: "wall", id: r.aId },
    );
  }
  if (suppressed > 0)
    report?.warning(
      "WALL_MERGE_REFUSALS_TRUNCATED",
      `${suppressed} more overlapping wall pairs were not merged.`,
    );

  if (removedCount > 0) {
    report?.stat("wallsMerged", removedCount);
    report?.stat("wallLengthRemovedFt", Math.round(removedLength * 1e6) / 1e6);
  }

  // Original order, with merged walls in place of their first contributor.
  const out: Wall[] = [];
  edges.forEach((e, g) => {
    if (absorbed.has(g)) return;
    out.push(replacement.get(g) ?? wallOf(idOf(e), e.a, e.b));
  });
  return out;
}
