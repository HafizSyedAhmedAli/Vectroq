// packages/cad-parser/src/normalize-segments.ts
//
// Phase 2, Stage 1: pure collinear-overlap merging.
//
// NOT WIRED IN. Nothing in the parser, Mode A, Mode B or the API imports this
// module yet. It only turns a list of tagged segments into a list in which
// every physical wall run is represented once (INV-2), plus a full account of
// what was merged and what was deliberately refused.
//
// Design rules (see the Phase 2 reports):
//  - Pure: no I/O, no mutation of the input, deterministic output.
//  - Never shortens a run: a merged segment is the 1-D UNION of its members,
//    so its length is the union length, never the sum (INV-1 / INV-2).
//  - No quantisation. Buckets/grids make decisions depend on where a boundary
//    happens to fall, so none are used: candidates are found with a
//    sweep-and-prune over inflated bounding boxes and every decision is made
//    with exact distance/angle predicates.
//  - No chain drift. Members are compared with ONE reference line (the longest
//    segment of the group), never with each other, so every original endpoint
//    of a merged run stays within `offsetTol` of the output line.
//  - Refuse rather than guess: property mismatches, same-side overlaps,
//    face-offset pairs, ambiguous angles and chain-drift pairs are reported in
//    `refusals` and left unmerged.

export interface MergeInputSeg {
  /** Label used for provenance only. Need not be unique. */
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Segments on different layers are never merged. undefined only matches undefined. */
  layer?: string;
  /** Segments with different thickness (ft) are never merged. undefined only matches undefined. */
  thickness?: number;
  /**
   * Side of the segment's own direction on which the enclosed space (room
   * interior) lies. Optional; when BOTH segments of an overlapping pair carry
   * it, same-side overlaps are refused and opposite-side overlaps (a shared
   * partition) are merged. When either is missing the check is skipped.
   */
  side?: "left" | "right";
}

export interface MergedSeg {
  /** Id of the first contributor in input order. */
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  layer?: string;
  thickness?: number;
  /** Kept only for un-merged segments; a merged run has no single interior side. */
  side?: "left" | "right";
  /** Ids of every contributor, in input order. A singleton lists itself. */
  sources: string[];
  /** Input indices of every contributor, ascending. */
  sourceIndices: number[];
}

export type MergeRefusalReason =
  | "LAYER_MISMATCH"
  | "THICKNESS_MISMATCH"
  | "SAME_SIDE_OVERLAP"
  | "FACE_OFFSET"
  | "ANGLE_AMBIGUOUS"
  | "CHAIN_DRIFT"
  | "CONFLICT_IN_GROUP";

export interface MergeRefusal {
  /** Input indices, a < b. */
  a: number;
  b: number;
  aId: string;
  bId: string;
  reason: MergeRefusalReason;
  detail: string;
}

export interface MergeRecord {
  /** Id of the output segment (first contributor). */
  id: string;
  sources: string[];
  sourceIndices: number[];
  /** Sum of the contributors' lengths. */
  inputLength: number;
  /** Length of the merged run (the union). */
  outputLength: number;
  /** inputLength - outputLength: the duplicated length that was removed. */
  removedLength: number;
  /** Largest distance of any contributor endpoint from the output line (<= offsetTol). */
  maxOffAxis: number;
}

export interface SkippedInput {
  index: number;
  id: string;
  reason: "DEGENERATE_INPUT";
  detail: string;
}

export interface MergeResult {
  /** In order of each output's first contributor. Degenerate inputs are passed through unchanged. */
  segs: MergedSeg[];
  merges: MergeRecord[];
  refusals: MergeRefusal[];
  skipped: SkippedInput[];
}

export interface MergeOptions {
  /** ft. Max distance of a member's endpoints from the reference line. */
  offsetTol?: number;
  /** radians. Max angle between a member and the reference line. */
  angleTolRad?: number;
  /** ft. Overlap must exceed this to count (a contained segment always counts). */
  minOverlap?: number;
  /** ft. Opposite-side parallel pairs this far apart (but beyond offsetTol) are refused as FACE_OFFSET. */
  faceOffsetMax?: number;
  /** radians. Overlapping pairs between angleTolRad and this are refused as ANGLE_AMBIGUOUS. */
  ambiguousAngleMaxRad?: number;
}

/**
 * CANDIDATE values only. 0.05 ft is not an approved tolerance (see the Phase 2
 * review); callers and tests pass explicit options where the value matters.
 */
export const DEFAULT_MERGE_OPTIONS: Required<MergeOptions> = {
  offsetTol: 0.05,
  angleTolRad: (0.5 * Math.PI) / 180,
  minOverlap: 0.1,
  faceOffsetMax: 1.125, // 1.5 x the 0.75 ft exterior thickness
  ambiguousAngleMaxRad: (5 * Math.PI) / 180,
};

/** Slack so "exactly at the tolerance" is inclusive despite floating point. */
const LEN_EPS = 1e-9;
const ANG_EPS = 1e-12;

interface Work {
  i: number;
  s: MergeInputSeg;
  valid: boolean;
  len: number;
  ux: number;
  uy: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface Metrics {
  /** Acute angle between the two lines, 0..PI/2. */
  angle: number;
  /** Signed perpendicular distance of the other segment's endpoints from the reference line. */
  d1: number;
  d2: number;
  /** Axis coordinates of the other segment's endpoints along the reference direction. */
  t1: number;
  t2: number;
}

function resolveOptions(o: MergeOptions): Required<MergeOptions> {
  const r = { ...DEFAULT_MERGE_OPTIONS, ...o };
  const pos = (n: number) => Number.isFinite(n) && n > 0;
  if (!pos(r.offsetTol)) throw new RangeError("offsetTol must be > 0");
  if (!pos(r.angleTolRad)) throw new RangeError("angleTolRad must be > 0");
  if (!(Number.isFinite(r.minOverlap) && r.minOverlap >= 0))
    throw new RangeError("minOverlap must be >= 0");
  if (!(Number.isFinite(r.faceOffsetMax) && r.faceOffsetMax >= r.offsetTol))
    throw new RangeError("faceOffsetMax must be >= offsetTol");
  if (!(
    Number.isFinite(r.ambiguousAngleMaxRad) &&
    r.ambiguousAngleMaxRad >= r.angleTolRad
  ))
    throw new RangeError("ambiguousAngleMaxRad must be >= angleTolRad");
  return r;
}

function toWork(s: MergeInputSeg, i: number): Work {
  const finite = [s.x1, s.y1, s.x2, s.y2].every(Number.isFinite);
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const len = finite ? Math.hypot(dx, dy) : 0;
  const valid = finite && len > LEN_EPS;
  return {
    i,
    s,
    valid,
    len,
    ux: valid ? dx / len : 0,
    uy: valid ? dy / len : 0,
    minX: Math.min(s.x1, s.x2),
    maxX: Math.max(s.x1, s.x2),
    minY: Math.min(s.y1, s.y2),
    maxY: Math.max(s.y1, s.y2),
  };
}

/** Where `c` lies relative to the line through `ref`. */
function metrics(ref: Work, c: Work): Metrics {
  const cross = ref.ux * c.uy - ref.uy * c.ux;
  const dot = ref.ux * c.ux + ref.uy * c.uy;
  const rel = (x: number, y: number) => {
    const px = x - ref.s.x1;
    const py = y - ref.s.y1;
    return {
      t: px * ref.ux + py * ref.uy,
      d: -px * ref.uy + py * ref.ux,
    };
  };
  const a = rel(c.s.x1, c.s.y1);
  const b = rel(c.s.x2, c.s.y2);
  return {
    angle: Math.atan2(Math.abs(cross), Math.abs(dot)),
    d1: a.d,
    d2: b.d,
    t1: a.t,
    t2: b.t,
  };
}

/** Overlap along a shared axis: positive and either > minOverlap or full containment of the shorter. */
function overlaps(
  aLo: number,
  aHi: number,
  bLo: number,
  bHi: number,
  minOverlap: number,
): boolean {
  const ov = Math.min(aHi, bHi) - Math.max(aLo, bLo);
  if (!(ov > 0)) return false; // gap or merely adjacent
  if (ov > minOverlap) return true;
  const shorter = Math.min(aHi - aLo, bHi - bLo);
  return shorter > 0 && ov >= shorter - LEN_EPS;
}

/** +1 / -1 / 0(unknown): the side of the interior relative to the left normal of axis (ux, uy). */
function absoluteSide(w: Work, ux: number, uy: number): number {
  if (w.s.side !== "left" && w.s.side !== "right") return 0;
  const own = w.s.side === "left" ? 1 : -1;
  const dirSign = w.ux * ux + w.uy * uy >= 0 ? 1 : -1;
  return own * dirSign;
}

function sameClass(a: Work, b: Work): boolean {
  return classMismatch(a, b) === null;
}

function classMismatch(a: Work, b: Work): MergeRefusalReason | null {
  if ((a.s.layer ?? null) !== (b.s.layer ?? null)) return "LAYER_MISMATCH";
  const ta = a.s.thickness;
  const tb = b.s.thickness;
  if (ta === undefined && tb === undefined) return null;
  if (ta === undefined || tb === undefined) return "THICKNESS_MISMATCH";
  return Math.abs(ta - tb) <= LEN_EPS ? null : "THICKNESS_MISMATCH";
}

/** Sweep-and-prune over bounding boxes inflated by `reach`. Neighbour lists are ascending. */
function buildNeighbours(work: Work[], reach: number): number[][] {
  const out: number[][] = work.map(() => []);
  const idx = work
    .filter((w) => w.valid)
    .sort((p, q) => p.minX - q.minX || p.i - q.i);
  for (let a = 0; a < idx.length; a++) {
    const p = idx[a];
    for (let b = a + 1; b < idx.length; b++) {
      const q = idx[b];
      if (q.minX - reach > p.maxX + reach) break;
      if (q.minY - reach > p.maxY + reach || p.minY - reach > q.maxY + reach)
        continue;
      out[p.i].push(q.i);
      out[q.i].push(p.i);
    }
  }
  for (const l of out) l.sort((x, y) => x - y);
  return out;
}

/**
 * Purely geometric total preorder: longer first, then canonical coordinates
 * (endpoints ordered lexicographically). It never looks at input order or at
 * direction, so every geometric decision that uses it is invariant under
 * shuffling and under reversing a segment. Returns 0 only for identical geometry.
 */
function compareGeometry(p: Work, q: Work): number {
  if (q.len !== p.len) return q.len - p.len;
  const canon = (w: Work): number[] => {
    const a = [w.s.x1, w.s.y1];
    const b = [w.s.x2, w.s.y2];
    return a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1])
      ? [...a, ...b]
      : [...b, ...a];
  };
  const cp = canon(p);
  const cq = canon(q);
  for (let k = 0; k < 4; k++) if (cp[k] !== cq[k]) return cp[k] - cq[k];
  return 0;
}

/** Deterministic leader order: geometric order, input index only between identical geometries. */
function leaderOrder(work: Work[]): Work[] {
  return work
    .filter((w) => w.valid)
    .sort((p, q) => compareGeometry(p, q) || p.i - q.i);
}

/**
 * The reference of a pair is the first in the geometric order, NOT the lower
 * input index, so the result does not depend on input order. (Index is used
 * only for identical geometries, where either choice gives the same answer.)
 */
function refFirst(a: Work, b: Work): [Work, Work] {
  const c = compareGeometry(a, b) || a.i - b.i;
  return c <= 0 ? [a, b] : [b, a];
}

/**
 * Merges overlapping collinear segments into one segment per physical run.
 *
 * Two segments are the same physical wall when, against the group's reference
 * (longest) segment, they are within `angleTolRad`, both endpoints are within
 * `offsetTol` of the reference line, and they overlap along it by more than
 * `minOverlap` (or one contains the other). Segments that merely touch end to
 * end are never merged. Properties (layer, thickness) must match.
 *
 * The merged segment spans the union interval on the reference line, starts
 * from the first contributor's direction, and keeps its id and properties.
 *
 * Order independence: which segments merge, where, and which pairs are
 * refused depend only on geometry (reference = longest, then canonical
 * coordinates). Input order only decides labels: the output id, direction,
 * `sources` order and the order of `segs`.
 *
 * Sides: when any two overlapping members of a candidate group carry the same
 * interior side (measured on the group's reference axis), the WHOLE group is
 * dissolved and every member is returned unchanged. Members without a side are
 * never in conflict.
 *
 * Limitations: the longest member fixes the reference line; a side conflict
 * dissolves the whole overlap group (conservative); a segment joins at most one
 * group per pass; and a second pass on the output is not guaranteed to be a
 * no-op for near-tolerance, tilted configurations (idempotency is only
 * expected when every pair is clearly within, or clearly beyond, tolerance).
 */
export function mergeCollinear(
  input: readonly MergeInputSeg[],
  options: MergeOptions = {},
): MergeResult {
  const o = resolveOptions(options);
  const work = input.map(toWork);
  const skipped: SkippedInput[] = work
    .filter((w) => !w.valid)
    .map((w) => ({
      index: w.i,
      id: w.s.id,
      reason: "DEGENERATE_INPUT" as const,
      detail: [w.s.x1, w.s.y1, w.s.x2, w.s.y2].every(Number.isFinite)
        ? "zero-length segment"
        : "non-finite coordinate",
    }));

  const reach = Math.max(o.offsetTol, o.faceOffsetMax);
  const nbrs = buildNeighbours(work, reach);

  /** Pair test with the longer segment as reference: same physical wall geometrically? */
  const sameGeometry = (
    a: Work,
    b: Work,
  ): { ref: Work; other: Work } | null => {
    const [ref, other] = refFirst(a, b);
    const m = metrics(ref, other);
    if (m.angle > o.angleTolRad + ANG_EPS) return null;
    if (
      Math.abs(m.d1) > o.offsetTol + LEN_EPS ||
      Math.abs(m.d2) > o.offsetTol + LEN_EPS
    )
      return null;
    return overlaps(
      0,
      ref.len,
      Math.min(m.t1, m.t2),
      Math.max(m.t1, m.t2),
      o.minOverlap,
    )
      ? { ref, other }
      : null;
  };

  // ---- 1. Group formation: leader + closure under "passes the leader's line test and overlaps a member".
  const groupOf = new Array<number>(work.length).fill(-1);
  const groups: {
    leader: Work;
    members: Work[];
    lo: Map<number, number>;
    hi: Map<number, number>;
    dissolved: boolean;
    /** Every overlapping member pair on the leader's axis, with whether it is a same-side conflict. */
    pairs: { a: Work; b: Work; same: boolean }[];
  }[] = [];

  for (const leader of leaderOrder(work)) {
    if (groupOf[leader.i] !== -1) continue;
    const g = {
      leader,
      members: [leader],
      lo: new Map<number, number>([[leader.i, 0]]),
      hi: new Map<number, number>([[leader.i, leader.len]]),
      dissolved: false,
      pairs: [] as { a: Work; b: Work; same: boolean }[],
    };
    const gid = groups.length;
    groupOf[leader.i] = gid;
    for (let q = 0; q < g.members.length; q++) {
      const m = g.members[q];
      for (const j of nbrs[m.i]) {
        if (groupOf[j] !== -1) continue;
        const c = work[j];
        if (!sameClass(leader, c)) continue;
        const mt = metrics(leader, c);
        if (mt.angle > o.angleTolRad + ANG_EPS) continue;
        if (
          Math.abs(mt.d1) > o.offsetTol + LEN_EPS ||
          Math.abs(mt.d2) > o.offsetTol + LEN_EPS
        )
          continue;
        const cLo = Math.min(mt.t1, mt.t2);
        const cHi = Math.max(mt.t1, mt.t2);
        if (!overlaps(g.lo.get(m.i)!, g.hi.get(m.i)!, cLo, cHi, o.minOverlap))
          continue;
        groupOf[j] = gid;
        g.members.push(c);
        g.lo.set(j, cLo);
        g.hi.set(j, cHi);
      }
    }
    groups.push(g);
  }

  // ---- 2. Side validation (only when both segments of an overlapping pair carry a side).
  const refusals: MergeRefusal[] = [];
  const refuse = (
    x: Work,
    y: Work,
    reason: MergeRefusalReason,
    detail: string,
  ) => {
    const [a, b] = x.i < y.i ? [x, y] : [y, x];
    refusals.push({
      a: a.i,
      b: b.i,
      aId: a.s.id,
      bId: b.s.id,
      reason,
      detail,
    });
  };

  // Every pair of members whose intervals overlap on the leader's axis is
  // examined, using the same intervals and the same overlap rule that formed the
  // group, and sides measured against that one axis. There is no separate
  // pairwise compatibility test, so a pair can only escape the check by NOT
  // overlapping, in which case it is not an overlap conflict by definition.
  // Any same-side pair dissolves the whole group.
  for (const g of groups) {
    if (g.members.length < 2) continue;
    const L = g.leader;
    const side = g.members.map((m) => absoluteSide(m, L.ux, L.uy));
    for (let p = 0; p < g.members.length; p++)
      for (let q = p + 1; q < g.members.length; q++) {
        const mp = g.members[p];
        const mq = g.members[q];
        if (
          !overlaps(
            g.lo.get(mp.i)!,
            g.hi.get(mp.i)!,
            g.lo.get(mq.i)!,
            g.hi.get(mq.i)!,
            o.minOverlap,
          )
        )
          continue;
        const same = side[p] !== 0 && side[p] === side[q];
        g.pairs.push({ a: mp, b: mq, same });
        if (same) g.dissolved = true;
      }
  }
  for (const g of groups)
    if (g.dissolved)
      for (const pr of g.pairs)
        refuse(
          pr.a,
          pr.b,
          pr.same ? "SAME_SIDE_OVERLAP" : "CONFLICT_IN_GROUP",
          pr.same
            ? "both interiors lie on the same side"
            : "overlapping pair left unmerged because another overlap in its group has a side conflict",
        );

  // ---- 3. Refusal report over every nearby pair.
  for (let i = 0; i < work.length; i++)
    for (const j of nbrs[i]) {
      if (j <= i) continue;
      const a = work[i];
      const b = work[j];
      const gi = groupOf[i];
      const gj = groupOf[j];
      const sharedGroup = gi === gj && gi !== -1;
      if (sharedGroup) continue; // merged, or reported from the group's own pair list above

      const geo = sameGeometry(a, b);
      if (geo) {
        const mismatch = classMismatch(a, b);
        if (mismatch) {
          refuse(
            a,
            b,
            mismatch,
            mismatch === "LAYER_MISMATCH"
              ? `layers differ (${a.s.layer ?? "none"} vs ${b.s.layer ?? "none"})`
              : `thickness differs (${a.s.thickness ?? "none"} vs ${b.s.thickness ?? "none"})`,
          );
          continue;
        }
        const sa = absoluteSide(geo.ref, geo.ref.ux, geo.ref.uy);
        const sb = absoluteSide(geo.other, geo.ref.ux, geo.ref.uy);
        if (sa !== 0 && sa === sb) {
          refuse(
            a,
            b,
            "SAME_SIDE_OVERLAP",
            "both interiors lie on the same side",
          );
        } else {
          refuse(
            a,
            b,
            "CHAIN_DRIFT",
            "pairwise compatible, but outside tolerance of the other group's reference line",
          );
        }
        continue;
      }

      // Not the same wall geometrically: is it a case we must flag instead of silently skipping?
      const [ref, other] = refFirst(a, b);
      const m = metrics(ref, other);
      const lo = Math.min(m.t1, m.t2);
      const hi = Math.max(m.t1, m.t2);
      if (!overlaps(0, ref.len, lo, hi, o.minOverlap)) continue;

      if (
        m.angle > o.angleTolRad + ANG_EPS &&
        m.angle <= o.ambiguousAngleMaxRad
      ) {
        // distance of `other` from the reference line at the ends of the overlap
        const span = m.t2 - m.t1;
        const at = (t: number) =>
          Math.abs(span) < LEN_EPS
            ? m.d1
            : m.d1 + ((t - m.t1) / span) * (m.d2 - m.d1);
        const oa = Math.max(0, lo);
        const ob = Math.min(ref.len, hi);
        const da = at(oa);
        const db = at(ob);
        if (
          da * db < 0 ||
          Math.min(Math.abs(da), Math.abs(db)) <= o.offsetTol + LEN_EPS
        )
          refuse(
            a,
            b,
            "ANGLE_AMBIGUOUS",
            `overlapping and ${((m.angle * 180) / Math.PI).toFixed(3)} deg apart`,
          );
        continue;
      }

      if (m.angle <= o.angleTolRad + ANG_EPS) {
        const sa = absoluteSide(ref, ref.ux, ref.uy);
        const sb = absoluteSide(other, ref.ux, ref.uy);
        const dMin = Math.min(Math.abs(m.d1), Math.abs(m.d2));
        const dMax = Math.max(Math.abs(m.d1), Math.abs(m.d2));
        if (
          sa !== 0 &&
          sb === -sa &&
          m.d1 * m.d2 > 0 &&
          dMin > o.offsetTol + LEN_EPS &&
          dMax <= o.faceOffsetMax + LEN_EPS
        ) {
          const away = sa * Math.sign(m.d1) < 0;
          refuse(
            a,
            b,
            "FACE_OFFSET",
            `parallel, opposite sides, ${dMax.toFixed(3)} ft apart (${away ? "back to back with a gap" : "facing, interiors overlap"})`,
          );
        }
      }
    }
  refusals.sort((p, q) => p.a - q.a || p.b - q.b);

  // ---- 4. Build the output.
  const segs: MergedSeg[] = [];
  const merges: MergeRecord[] = [];
  const pass = (w: Work): MergedSeg => ({
    id: w.s.id,
    x1: w.s.x1,
    y1: w.s.y1,
    x2: w.s.x2,
    y2: w.s.y2,
    ...(w.s.layer !== undefined ? { layer: w.s.layer } : {}),
    ...(w.s.thickness !== undefined ? { thickness: w.s.thickness } : {}),
    ...(w.s.side !== undefined ? { side: w.s.side } : {}),
    sources: [w.s.id],
    sourceIndices: [w.i],
  });

  const emitted: { first: number; seg: MergedSeg }[] = [];
  for (const w of work)
    if (!w.valid) emitted.push({ first: w.i, seg: pass(w) });

  for (const g of groups) {
    if (g.members.length < 2 || g.dissolved) {
      for (const w of g.members) emitted.push({ first: w.i, seg: pass(w) });
      continue;
    }
    const ms = [...g.members].sort((p, q) => p.i - q.i);
    const first = ms[0];
    const L = g.leader;
    let lo = Infinity;
    let hi = -Infinity;
    let off = 0;
    let inputLength = 0;
    for (const m of ms) {
      lo = Math.min(lo, g.lo.get(m.i)!);
      hi = Math.max(hi, g.hi.get(m.i)!);
      inputLength += m.len;
      const mt = metrics(L, m);
      off = Math.max(off, Math.abs(mt.d1), Math.abs(mt.d2));
    }
    const at = (t: number): [number, number] =>
      t === 0
        ? [L.s.x1, L.s.y1]
        : t === L.len
          ? [L.s.x2, L.s.y2]
          : [L.s.x1 + L.ux * t, L.s.y1 + L.uy * t];
    const forward = first.ux * L.ux + first.uy * L.uy >= 0;
    const [sx, sy] = at(forward ? lo : hi);
    const [ex, ey] = at(forward ? hi : lo);
    const seg: MergedSeg = {
      id: first.s.id,
      x1: sx,
      y1: sy,
      x2: ex,
      y2: ey,
      ...(first.s.layer !== undefined ? { layer: first.s.layer } : {}),
      ...(first.s.thickness !== undefined
        ? { thickness: first.s.thickness }
        : {}),
      sources: ms.map((m) => m.s.id),
      sourceIndices: ms.map((m) => m.i),
    };
    emitted.push({ first: first.i, seg });
    merges.push({
      id: seg.id,
      sources: seg.sources,
      sourceIndices: seg.sourceIndices,
      inputLength,
      outputLength: hi - lo,
      removedLength: inputLength - (hi - lo),
      maxOffAxis: off,
    });
  }

  emitted.sort((p, q) => p.first - q.first);
  merges.sort((p, q) => p.sourceIndices[0] - q.sourceIndices[0]);
  for (const e of emitted) segs.push(e.seg);

  return { segs, merges, refusals, skipped };
}

/** Sum of segment lengths. Handy for the "union, not sum" checks. */
export function totalLength(
  segs: readonly Pick<MergeInputSeg, "x1" | "y1" | "x2" | "y2">[],
): number {
  return segs.reduce((s, g) => s + Math.hypot(g.x2 - g.x1, g.y2 - g.y1), 0);
}
