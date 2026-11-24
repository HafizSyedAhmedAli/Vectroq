// packages/cad-parser/src/orientation.ts
//
// Phase 2, Stage 3b: dominant-orientation detection for a floor plan.
//
// Pure: reads wall segments (feet) and returns a decision. It never modifies
// geometry. The segments are the ones dxfToGeometry would build walls from
// (Mode A: edges of closed WALLS polylines; Mode B: WALLS LINEs).
//
// ORIENTATION MODEL. Undirected: a wall at theta and at theta + pi are the same.
// A building has two wall families 90 degrees apart, so the statistic is the
// length-weighted circular mean of 4*theta (sum len*cos 4t, sum len*sin 4t),
// phi = atan2(S, C) / 4, which lies in (-pi/4, pi/4]. It is then refined by a
// histogram peak and a robust re-average over the segments near the peak.
//
// CANONICAL ANGLE. phi in (-pi/4, +pi/4]; -pi/4 maps to +pi/4. The rotation to
// apply is -phi (see rotate-entities.ts for the sign convention).
//
// DUPLICATES. Before any statistics, collinear segments (exact, reversed,
// partial, contained) are collapsed into their union so a wall drawn by two
// rooms counts once. Tolerance 1e-9 * drawing diagonal: precision only, not a
// drafting offset. This collapse is for statistics only; it never changes geometry.
//
// CONFIDENCE (all must hold, else no rotation):
//   1. >= 4 eligible segments (after the duplicate collapse)
//   2. the dominant family (both axes of the orientation) is >= 70% of length
//   3. dominant length >= 2 x the longest competing family
//   4. a genuine perpendicular family: >= 2 segments of the minor axis, each
//      bridging two DISTINCT segments of the major axis (an endpoint on each,
//      tolerance 8*EPSILON*M + 1e-6 ft), whose positions along the major axis
//      span >= 50% of its extent.

export interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type OrientationStatus =
  | "rotate" // confident, rotation required
  | "aligned" // already axis-aligned (|phi| <= ROTATION_EPS = 1e-6 rad): nothing to do
  | "insufficient" // too few eligible segments: silent, no rotation
  | "uncertain"; // evidence of a rotated plan but not confident: warn, no rotation

export interface OrientationResult {
  status: OrientationStatus;
  /** Canonical dominant orientation in (-pi/4, pi/4]; 0 when none was estimated. */
  detectedRad: number;
  /** The rotation to apply: -detectedRad when status is "rotate", otherwise 0. */
  rotationRad: number;
  eligibleSegments: number;
  dominantShare: number;
  /** Why confidence failed (status "uncertain" only). */
  reason?: string;
}

/** At or below this (1e-6 rad, about 5.7e-5 degrees) the plan is treated as axis-aligned. */
export const ROTATION_EPS = 1e-6;
export const MIN_SEGMENTS = 4;
export const MIN_DOMINANT_SHARE = 0.7;
export const MIN_DOMINANCE_RATIO = 2;
export const MIN_BRIDGERS = 2;
export const MIN_SPAN_FRACTION = 0.5;
/** Segments within this of an axis belong to its family. */
export const FAMILY_TOL_RAD = (2 * Math.PI) / 180;
const REFINE_TOL_RAD = (3 * Math.PI) / 180;
const HIST_BIN = Math.PI / 720; // 0.25 degrees

const HALF_PI = Math.PI / 2;

/** Wraps an angle difference of axes (period pi/2) into (-pi/4, pi/4]. */
export function wrapQuarter(a: number): number {
  let r = a % HALF_PI;
  if (r <= -Math.PI / 4) r += HALF_PI;
  if (r > Math.PI / 4) r -= HALF_PI;
  return r;
}

/** Canonical orientation: any angle -> (-pi/4, pi/4], never outside. */
export function canonicalOrientation(a: number): number {
  const r = wrapQuarter(a);
  // wrapQuarter is exact on the boundaries, but never trust a comparison alone
  if (r <= -Math.PI / 4) return Math.PI / 4;
  if (r > Math.PI / 4) return Math.PI / 4;
  return r;
}

/** True when a canonical orientation is within the no-op threshold (|phi| <= 1e-6 rad). */
export function isAlignedAngle(phi: number): boolean {
  return Math.abs(phi) <= ROTATION_EPS;
}

export interface DetectStats {
  /** Perpendicular segments tested as bridges. */
  perpendicularSegments: number;
  /** Dominant-family segments available to be bridged. */
  dominantSegments: number;
  /** Exact point-to-segment distance evaluations made while looking for bridges. */
  bridgeDistanceChecks: number;
  /** True when the search stopped early because acceptance was already certain. */
  earlyExit: boolean;
}

export interface DetectOptions {
  /** Receives deterministic operation counts (for complexity tests). */
  stats?: DetectStats;
  /**
   * Use the original all-pairs bridge search (the reference the indexed search
   * must agree with). Slow; for tests only.
   */
  bruteForceBridging?: boolean;
}

const len = (s: Seg) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
const theta = (s: Seg) => Math.atan2(s.y2 - s.y1, s.x2 - s.x1);

/**
 * Collapses exact, reversed, partial and contained collinear duplicates into
 * the union of each collinear run. Separate parallel walls are never merged.
 */
export function collapseCollinear(segs: Seg[], tol: number): Seg[] {
  type G = {
    ox: number;
    oy: number;
    ux: number;
    uy: number;
    iv: [number, number][];
  };
  const usable = segs
    .filter((s) => [s.x1, s.y1, s.x2, s.y2].every(Number.isFinite))
    .map((s) => ({ s, l: len(s) }))
    .filter((x) => x.l > tol)
    .sort((a, b) => b.l - a.l);
  const groups: G[] = [];
  for (const { s, l } of usable) {
    let g = groups.find((q) => {
      const d1 = Math.abs(q.ux * (s.y1 - q.oy) - q.uy * (s.x1 - q.ox));
      const d2 = Math.abs(q.ux * (s.y2 - q.oy) - q.uy * (s.x2 - q.ox));
      return d1 <= tol && d2 <= tol;
    });
    if (!g) {
      g = {
        ox: s.x1,
        oy: s.y1,
        ux: (s.x2 - s.x1) / l,
        uy: (s.y2 - s.y1) / l,
        iv: [],
      };
      groups.push(g);
    }
    const t1 = g.ux * (s.x1 - g.ox) + g.uy * (s.y1 - g.oy);
    const t2 = g.ux * (s.x2 - g.ox) + g.uy * (s.y2 - g.oy);
    g.iv.push([Math.min(t1, t2), Math.max(t1, t2)]);
  }
  const out: Seg[] = [];
  for (const g of groups) {
    g.iv.sort((a, b) => a[0] - b[0]);
    let [a, b] = g.iv[0];
    const emit = () =>
      out.push({
        x1: g.ox + g.ux * a,
        y1: g.oy + g.uy * a,
        x2: g.ox + g.ux * b,
        y2: g.oy + g.uy * b,
      });
    for (const [c, d] of g.iv.slice(1)) {
      if (c <= b) b = Math.max(b, d);
      else {
        emit();
        a = c;
        b = d;
      }
    }
    emit();
  }
  return out;
}

function pointSegDist(px: number, py: number, s: Seg): number {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const l2 = dx * dx + dy * dy;
  const t =
    l2 === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - s.x1) * dx + (py - s.y1) * dy) / l2));
  return Math.hypot(px - (s.x1 + t * dx), py - (s.y1 + t * dy));
}

/** Estimates the dominant orientation of (already collapsed) segments. */
function dominantAxis(segs: Seg[]): number | null {
  let C = 0;
  let S = 0;
  for (const s of segs) {
    const l = len(s);
    const t = theta(s);
    C += l * Math.cos(4 * t);
    S += l * Math.sin(4 * t);
  }
  if (Math.hypot(C, S) < 1e-12) return null;
  let phi = Math.atan2(S, C) / 4;

  // histogram refinement: peak of the length histogram of the folded angle
  const nBins = Math.round(HALF_PI / HIST_BIN);
  const bins = new Array<number>(nBins).fill(0);
  for (const s of segs) {
    const d = wrapQuarter(theta(s) - phi) + Math.PI / 4; // [0, pi/2]
    bins[Math.min(nBins - 1, Math.floor(d / HIST_BIN))] += len(s);
  }
  let best = 0;
  let bestSum = -1;
  for (let i = 0; i < nBins; i++) {
    let sum = 0;
    for (let k = -2; k <= 2; k++) sum += bins[(i + k + nBins) % nBins];
    if (sum > bestSum) {
      bestSum = sum;
      best = i;
    }
  }
  let centre = phi + (best + 0.5) * HIST_BIN - Math.PI / 4;

  // robust re-average around the peak, twice, narrowing the window
  for (const tol of [REFINE_TOL_RAD, FAMILY_TOL_RAD / 2]) {
    let c = 0;
    let s2 = 0;
    for (const s of segs) {
      const d = wrapQuarter(theta(s) - centre);
      if (Math.abs(d) > tol) continue;
      const l = len(s);
      c += l * Math.cos(4 * d);
      s2 += l * Math.sin(4 * d);
    }
    if (Math.hypot(c, s2) < 1e-12) break;
    centre += Math.atan2(s2, c) / 4;
  }
  return canonicalOrientation(centre);
}

export function detectOrientation(
  rawSegs: Seg[],
  opts: DetectOptions = {},
): OrientationResult {
  const none = (
    status: OrientationStatus,
    n: number,
    share = 0,
    reason?: string,
  ): OrientationResult => ({
    status,
    detectedRad: 0,
    rotationRad: 0,
    eligibleSegments: n,
    dominantShare: share,
    ...(reason ? { reason } : {}),
  });

  const finite = rawSegs.filter((s) =>
    [s.x1, s.y1, s.x2, s.y2].every(Number.isFinite),
  );
  if (finite.length === 0) return none("insufficient", 0);
  const xs = finite.flatMap((s) => [s.x1, s.x2]);
  const ys = finite.flatMap((s) => [s.y1, s.y2]);
  const diag = Math.hypot(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
  );
  const segs = collapseCollinear(finite, 1e-9 * diag);
  const n = segs.length;
  if (n < MIN_SEGMENTS) return none("insufficient", n);

  const phi = dominantAxis(segs);
  if (phi === null) return none("uncertain", n, 0, "no dominant orientation");

  const total = segs.reduce((a, s) => a + len(s), 0);
  const isDom = (s: Seg) =>
    Math.abs(wrapQuarter(theta(s) - phi)) <= FAMILY_TOL_RAD;
  const dom = segs.filter(isDom);
  const domLen = dom.reduce((a, s) => a + len(s), 0);
  const share = total > 0 ? domLen / total : 0;

  // already aligned: nothing to apply, nothing to say
  if (isAlignedAngle(phi)) {
    return { ...none("aligned", n, share) };
  }

  const fail = (reason: string): OrientationResult =>
    // only a plan with real orientation consensus is worth a warning
    share >= 0.5
      ? none("uncertain", n, share, reason)
      : none("insufficient", n, share);

  if (share < MIN_DOMINANT_SHARE)
    return fail(
      `the dominant orientation covers ${(share * 100).toFixed(0)}% of wall length (needs ${MIN_DOMINANT_SHARE * 100}%)`,
    );

  // longest competing orientation family (folded to a quarter turn, 4 degree window)
  const rest = segs.filter((s) => !isDom(s));
  const nb = 90;
  const rb = new Array<number>(nb).fill(0);
  for (const s of rest) {
    const d = (((theta(s) % HALF_PI) + HALF_PI) % HALF_PI) / HALF_PI;
    rb[Math.min(nb - 1, Math.floor(d * nb))] += len(s);
  }
  let competing = 0;
  for (let i = 0; i < nb; i++) {
    let sum = 0;
    for (let k = 0; k < 4; k++) sum += rb[(i + k) % nb];
    competing = Math.max(competing, sum);
  }
  if (competing > 0 && domLen < MIN_DOMINANCE_RATIO * competing)
    return fail("a competing orientation family is too strong");

  // perpendicular evidence
  const hAxis = phi;
  const along = (s: Seg, a: number) =>
    Math.abs(wrapQuarter(theta(s) - a)) <= FAMILY_TOL_RAD &&
    Math.abs(Math.sin(theta(s) - a)) <= FAMILY_TOL_RAD; // parallel to axis a
  const fam = (a: number) => dom.filter((s) => along(s, a));
  const famLen = (a: number) => fam(a).reduce((x, s) => x + len(s), 0);
  const majorAxis =
    famLen(hAxis) >= famLen(hAxis + HALF_PI) ? hAxis : hAxis + HALF_PI;
  const D = fam(majorAxis);
  const P = fam(majorAxis + HALF_PI);
  const ux = Math.cos(majorAxis);
  const uy = Math.sin(majorAxis);
  const proj = (x: number, y: number) => x * ux + y * uy;
  let lo = Infinity;
  let hi = -Infinity;
  // the largest coordinate among the dominant-family segments: computed once
  let MD = 0;
  for (const s of D) {
    for (const v of [proj(s.x1, s.y1), proj(s.x2, s.y2)]) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    MD = Math.max(
      MD,
      Math.abs(s.x1),
      Math.abs(s.y1),
      Math.abs(s.x2),
      Math.abs(s.y2),
    );
  }
  const extent = hi - lo;
  const stats = opts.stats;
  if (stats) {
    stats.perpendicularSegments = P.length;
    stats.dominantSegments = D.length;
    stats.bridgeDistanceChecks = 0;
    stats.earlyExit = false;
  }
  // Tolerance for one perpendicular segment: 8*EPSILON*M + 1e-6 ft, where M is
  // the largest absolute coordinate among that segment and the dominant family.
  const tolFor = (p: Seg) =>
    8 *
      Number.EPSILON *
      Math.max(
        MD,
        Math.abs(p.x1),
        Math.abs(p.y1),
        Math.abs(p.x2),
        Math.abs(p.y2),
      ) +
    1e-6;
  const dist = (x: number, y: number, d: Seg) => {
    if (stats) stats.bridgeDistanceChecks++;
    return pointSegDist(x, y, d);
  };

  const bridgers: number[] = [];
  let minPos = Infinity;
  let maxPos = -Infinity;
  const addBridge = (p: Seg) => {
    const v = (proj(p.x1, p.y1) + proj(p.x2, p.y2)) / 2;
    bridgers.push(v);
    minPos = Math.min(minPos, v);
    maxPos = Math.max(maxPos, v);
  };
  /** Acceptance can only become more certain as bridges are added, so stop once it holds. */
  const accepted = () =>
    bridgers.length >= MIN_BRIDGERS &&
    extent > 0 &&
    maxPos - minPos >= MIN_SPAN_FRACTION * extent;

  if (opts.bruteForceBridging) {
    // reference: every perpendicular segment against every dominant segment
    for (const p of P) {
      const tol = tolFor(p);
      const onA: number[] = [];
      const onB: number[] = [];
      D.forEach((d, i) => {
        if (dist(p.x1, p.y1, d) <= tol) onA.push(i);
        if (dist(p.x2, p.y2, d) <= tol) onB.push(i);
      });
      if (onA.some((i) => onB.some((j) => j !== i))) addBridge(p);
    }
  } else {
    // Index the dominant segments by their coordinate across the major axis (w).
    // A point can only be within tol of a segment if its w and u lie within tol
    // of that segment's w and u ranges (projection never increases distance), so
    // the candidates are a superset and the exact distance test below decides.
    const nx = -uy;
    const ny = ux;
    const wOf = (x: number, y: number) => x * nx + y * ny;
    const CELL = 0.25; // ft
    const WIDE_CELLS = 64;
    type Ent = {
      i: number;
      d: Seg;
      wlo: number;
      whi: number;
      ulo: number;
      uhi: number;
    };
    const cells = new Map<number, Ent[]>();
    const wide: Ent[] = [];
    let tolMax = 0;
    // M_all: the largest absolute coordinate among the dominant and perpendicular segments
    let Mall = MD;
    for (const p of P) {
      tolMax = Math.max(tolMax, tolFor(p));
      Mall = Math.max(
        Mall,
        Math.abs(p.x1),
        Math.abs(p.y1),
        Math.abs(p.x2),
        Math.abs(p.y2),
      );
    }
    // Floating-point safety margin for CANDIDATE DISCOVERY ONLY. The w / u of a
    // point and of a segment are computed projections, each carrying rounding error
    // of a few ulp(M_all); without a margin a candidate whose true distance is within
    // an ulp of the touching tolerance could be dropped here although the all-pairs
    // search would inspect it. The margin only widens the candidate set (the cell
    // range and the range pre-filter): acceptance still requires the unchanged exact
    // pointSegDist(...) <= tol, with the unchanged tol.
    const SLACK = 16 * Number.EPSILON * Mall;
    D.forEach((d, i) => {
      const w1 = wOf(d.x1, d.y1);
      const w2 = wOf(d.x2, d.y2);
      const u1 = proj(d.x1, d.y1);
      const u2 = proj(d.x2, d.y2);
      const e: Ent = {
        i,
        d,
        wlo: Math.min(w1, w2),
        whi: Math.max(w1, w2),
        ulo: Math.min(u1, u2),
        uhi: Math.max(u1, u2),
      };
      const c0 = Math.floor((e.wlo - tolMax - SLACK) / CELL);
      const c1 = Math.floor((e.whi + tolMax + SLACK) / CELL);
      if (c1 - c0 + 1 > WIDE_CELLS) {
        wide.push(e);
        return;
      }
      for (let c = c0; c <= c1; c++) {
        const list = cells.get(c);
        if (list) list.push(e);
        else cells.set(c, [e]);
      }
    });
    const near = (x: number, y: number, tol: number): number[] => {
      const w = wOf(x, y);
      const u = proj(x, y);
      const hit = new Set<number>();
      const test = (e: Ent) => {
        if (
          w < e.wlo - tol - SLACK ||
          w > e.whi + tol + SLACK ||
          u < e.ulo - tol - SLACK ||
          u > e.uhi + tol + SLACK ||
          hit.has(e.i)
        )
          return;
        if (dist(x, y, e.d) <= tol) hit.add(e.i);
      };
      const list = cells.get(Math.floor(w / CELL));
      if (list) list.forEach(test);
      wide.forEach(test);
      return [...hit];
    };
    for (const p of P) {
      const tol = tolFor(p);
      const onA = near(p.x1, p.y1, tol);
      if (onA.length === 0) continue;
      const onB = near(p.x2, p.y2, tol);
      if (onA.some((i) => onB.some((j) => j !== i))) {
        addBridge(p);
        if (accepted()) {
          if (stats) stats.earlyExit = true;
          break;
        }
      }
    }
  }
  if (bridgers.length < MIN_BRIDGERS)
    return fail("no perpendicular wall family bridging two parallel walls");
  if (!accepted())
    return fail("the perpendicular walls do not span half of the plan");

  return {
    status: "rotate",
    detectedRad: phi,
    rotationRad: -phi,
    eligibleSegments: n,
    dominantShare: share,
  };
}

/** Wall segments dxfToGeometry would build walls from (Mode A, else Mode B). */
export function wallSegmentsOf(entities: any[]): Seg[] {
  const isWall = (e: any) => /^walls?$/i.test((e?.layer ?? "").trim());
  const polys = entities.filter(
    (e) => e.type === "LWPOLYLINE" && isWall(e) && Array.isArray(e.vertices),
  );
  if (polys.length > 0) {
    return polys.flatMap((p) =>
      p.vertices.map((a: any, i: number) => {
        const b = p.vertices[(i + 1) % p.vertices.length];
        return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
      }),
    );
  }
  return entities
    .filter((e) => e.type === "LINE" && isWall(e) && e.vertices?.length >= 2)
    .map((l) => ({
      x1: l.vertices[0].x,
      y1: l.vertices[0].y,
      x2: l.vertices[1].x,
      y2: l.vertices[1].y,
    }));
}
