// packages/cad-parser/src/topology.ts
// Phase 2 Stage 3c-0: ENDPOINT TOPOLOGY DIAGNOSTICS. Pure and read-only.
//
// The analyzer looks at the segments exactly as drawn and reports, for every
// segment endpoint, whether it already meets another wall, would meet exactly
// one (unique), several (ambiguous), is only near something (report-only), or
// is a free end (isolated). It never moves, extends, trims, splits or merges a
// segment and nothing it returns is read by geometry construction in this stage.
//
// PROVISIONAL values (not validated on a real-plan corpus; expect to revisit):
//   connectionToleranceFt 0.05   an endpoint within this (Euclidean) of a wall's
//                                line/end is a connection candidate
//   reportBandFt          0.25   upper bound for report-only near-misses
//   minJunctionAngleDeg   15     L/T junctions need at least this angle
//   shortSegmentFt        0.1    segments this short are classified and flagged
//                                but never used as inferred targets
//
// Feet are only meaningful when the drawing's unit is trusted; the integration
// layer therefore runs this only for unitTrusted === true.
import type { Seg } from "./line-plan";
import type { EndpointRef, WallProvenance } from "./provenance";

export interface TopologyOptions {
  /** ft. Default 0.05 (provisional). */
  connectionToleranceFt?: number;
  /** ft. Default 0.25 (provisional). Candidates between the tolerance and this are report-only. */
  reportBandFt?: number;
  /** degrees. Default 15 (provisional). */
  minJunctionAngleDeg?: number;
  /** ft. Default 0.1 (provisional). Segments this short are flagged and never inferred targets. */
  shortSegmentFt?: number;
  /** Test hook: discover neighbours by brute force instead of the sweep index. */
  bruteForce?: boolean;
}

export const TOPOLOGY_DEFAULTS = {
  connectionToleranceFt: 0.05,
  reportBandFt: 0.25,
  minJunctionAngleDeg: 15,
  shortSegmentFt: 0.1,
} as const;

/** Pairs closer than this angle are treated as collinear (Stage 3a merges at 0.5 degrees). Provisional. */
export const COLLINEAR_ANGLE_MAX_DEG = 1;
/** A segment this close to an axis counts as axis-aligned for canonical junction coordinates (ft, same as line-plan EPS). */
const AXIS_TOL = 0.01;

export type EndpointState =
  "satisfied" | "unique" | "ambiguous" | "report-only" | "isolated";
export type CandidateKind = "L" | "T" | "COLLINEAR";

export interface Pt {
  x: number;
  y: number;
}

export interface TopologyCandidate {
  /** Topology segment index of the target. */
  target: number;
  /** COLLINEAR only: which end of the target the bridge would meet. */
  targetEnd?: 0 | 1;
  kind: CandidateKind;
  /** Distance the endpoint would travel along its own line to reach the junction (ft). */
  extension: number;
  /** Distance the junction lies beyond the target's end (ft); collinear: perpendicular offset. */
  slack: number;
  /** Math.hypot(extension, slack). */
  total: number;
  /** Acute angle between the two lines (degrees). */
  angleDeg: number;
  /** Junction point (collinear: the target's near end). */
  point: Pt;
  /** The endpoint already pokes past the target (junction lies behind it). */
  overshoot: boolean;
  /** Within the connection tolerance AND not rejected for another reason. */
  inTolerance: boolean;
  /** OUT_OF_TOLERANCE | ANGLE_BELOW_MIN | SHORT_TARGET | SUPERSEDED_BY_JUNCTION */
  reasons: string[];
}

export interface EndpointDecision {
  seg: number;
  end: 0 | 1;
  /** The endpoint as drawn. */
  at: Pt;
  state: EndpointState;
  candidates: TopologyCandidate[];
  /**
   * CONTACT | OVERSHOOT_CROSSES | SHORT_SEGMENT | DEGENERATE_SEGMENT |
   * AMBIGUOUS_JUNCTION_POINTS | NOT_MUTUAL | PARTNER_UNRESOLVED | NO_CANDIDATE
   */
  reasons: string[];
  /** Set only for `unique`. */
  junctionPoint?: Pt;
  /** Set only for `unique`: the node this endpoint contributes to. */
  nodeId?: number;
  /** The segment is at or below shortSegmentFt. */
  short: boolean;
}

export interface JunctionNode {
  id: number;
  kind: "junction" | "bridge";
  /** Canonical coordinate for axis-aligned perpendicular junctions; else the junction point; bridge: midpoint. */
  point: Pt;
  /** True when `point` took canonical target coordinates. */
  canonical: boolean;
  /** Endpoints that would meet here (sorted). */
  endpoints: EndpointRef[];
  /** Host segments (junction only; sorted). */
  hosts: number[];
}

export interface TopologyCounts {
  segments: number;
  endpoints: number;
  satisfied: number;
  unique: number;
  ambiguous: number;
  reportOnly: number;
  isolated: number;
  shortSegments: number;
  nodes: number;
  /** (endpoint, target) evaluations performed. */
  candidatePairsEvaluated: number;
  /** Unordered neighbour pairs produced by discovery. */
  indexPairs: number;
}

export interface TopologyLedger {
  config: {
    connectionToleranceFt: number;
    reportBandFt: number;
    minJunctionAngleDeg: number;
    shortSegmentFt: number;
    /** 1e-6 + 16 * EPSILON * max|coordinate| */
    epsilon: number;
    bruteForce: boolean;
  };
  /** Clones of the analyzed segments; indices are topology segment indices. */
  segments: Seg[];
  /** Deep clone of the provenance passed in. */
  provenance: WallProvenance;
  decisions: EndpointDecision[];
  nodes: JunctionNode[];
  counts: TopologyCounts;
}

const lenOf = (s: Seg) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
const finite = (s: Seg) =>
  Number.isFinite(s.x1) &&
  Number.isFinite(s.y1) &&
  Number.isFinite(s.x2) &&
  Number.isFinite(s.y2);

export function topologyEpsilon(segs: readonly Seg[]): number {
  let m = 0;
  for (const s of segs)
    for (const v of [s.x1, s.y1, s.x2, s.y2])
      if (Number.isFinite(v)) m = Math.max(m, Math.abs(v));
  return 1e-6 + 16 * Number.EPSILON * m;
}

/**
 * Neighbour discovery: sweep over x with a y-interval test on boxes inflated by
 * `infl`. Returns sorted neighbour lists plus the number of unordered pairs.
 */
export function neighbourPairs(
  segs: readonly Seg[],
  infl: number,
  brute = false,
): { nb: number[][]; pairs: number } {
  const n = segs.length;
  const nb: number[][] = Array.from({ length: n }, () => []);
  let pairs = 0;
  const ok = (i: number) => finite(segs[i]);
  const lo = segs.map((s) => [
    Math.min(s.x1, s.x2) - infl,
    Math.min(s.y1, s.y2) - infl,
  ]);
  const hi = segs.map((s) => [
    Math.max(s.x1, s.x2) + infl,
    Math.max(s.y1, s.y2) + infl,
  ]);
  const link = (i: number, j: number) => {
    nb[i].push(j);
    nb[j].push(i);
    pairs++;
  };
  if (brute) {
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) if (ok(i) && ok(j)) link(i, j);
  } else {
    const ord = [...Array(n).keys()]
      .filter(ok)
      .sort((a, b) => lo[a][0] - lo[b][0] || a - b);
    for (let a = 0; a < ord.length; a++) {
      const i = ord[a];
      for (let b = a + 1; b < ord.length; b++) {
        const j = ord[b];
        if (lo[j][0] > hi[i][0]) break;
        if (lo[j][1] <= hi[i][1] && hi[j][1] >= lo[i][1]) link(i, j);
      }
    }
  }
  nb.forEach((l) => l.sort((a, b) => a - b));
  return { nb, pairs };
}

const KIND_ORDER: Record<CandidateKind, number> = { L: 0, T: 1, COLLINEAR: 2 };

function sortCandidates(c: TopologyCandidate[]) {
  c.sort(
    (a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.point.x - b.point.x ||
      a.point.y - b.point.y ||
      a.extension - b.extension ||
      a.slack - b.slack ||
      a.angleDeg - b.angleDeg ||
      a.target - b.target,
  );
}

/**
 * Single-link clusters (distance <= tol). Returns, per input point, the index of
 * its cluster, and one representative (the lexicographically smallest member) per
 * cluster, ordered lexicographically. Sweep over x keeps this near-linear.
 */
function clusterPoints(
  pts: readonly Pt[],
  tol: number,
): { reps: Pt[]; of: number[] } {
  const ord = pts
    .map((_, i) => i)
    .sort((a, b) => pts[a].x - pts[b].x || pts[a].y - pts[b].y || a - b);
  const parent = pts.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };
  for (let a = 0; a < ord.length; a++)
    for (let b = a + 1; b < ord.length; b++) {
      if (pts[ord[b]].x - pts[ord[a]].x > tol) break;
      if (
        Math.hypot(
          pts[ord[a]].x - pts[ord[b]].x,
          pts[ord[a]].y - pts[ord[b]].y,
        ) <= tol
      )
        parent[find(ord[b])] = find(ord[a]);
    }
  const repIndex = new Map<number, number>();
  const reps: Pt[] = [];
  const of: number[] = new Array(pts.length);
  for (const i of ord) {
    const r = find(i);
    if (!repIndex.has(r)) {
      repIndex.set(r, reps.length);
      reps.push(pts[i]);
    }
    of[i] = repIndex.get(r)!;
  }
  return { reps, of };
}

const close = (a: Pt, b: Pt, tol: number) =>
  Math.hypot(a.x - b.x, a.y - b.y) <= tol;

/**
 * @param segs        topology segments (= legacy segments). Not mutated.
 * @param provenance  stored (cloned) in the ledger; not mutated, not interpreted.
 */
export function analyzeEndpointTopology(
  segs: readonly Seg[],
  provenance: WallProvenance,
  options: TopologyOptions = {},
): TopologyLedger {
  const tol =
    options.connectionToleranceFt ?? TOPOLOGY_DEFAULTS.connectionToleranceFt;
  const band = Math.max(
    options.reportBandFt ?? TOPOLOGY_DEFAULTS.reportBandFt,
    tol,
  );
  const minAngle =
    options.minJunctionAngleDeg ?? TOPOLOGY_DEFAULTS.minJunctionAngleDeg;
  const shortFt = options.shortSegmentFt ?? TOPOLOGY_DEFAULTS.shortSegmentFt;
  const brute = options.bruteForce === true;

  const S: Seg[] = segs.map((s) => ({
    x1: s.x1,
    y1: s.y1,
    x2: s.x2,
    y2: s.y2,
  }));
  const e = topologyEpsilon(S);
  const within = (ext: number, slack: number, lim: number) =>
    Math.hypot(ext, slack) <= lim + e;
  // Both boxes of a pair are inflated, so a pair is found when the gap between the raw
  // boxes is <= 2 * infl. A candidate needs a point-to-segment distance <= ext + slack
  // <= sqrt(2) * band < 2 * band, so infl = band (+ float slack) cannot omit one.
  const { nb, pairs } = neighbourPairs(S, band + e + 1e-3, brute);
  const lens = S.map((s) => (finite(s) ? lenOf(s) : NaN));
  const usable = (i: number) => lens[i] > 0;
  const isShort = (i: number) => usable(i) && lens[i] <= shortFt;

  const decisions: EndpointDecision[] = [];
  let evaluated = 0;
  const at = (i: number, end: 0 | 1): Pt =>
    end === 0 ? { x: S[i].x1, y: S[i].y1 } : { x: S[i].x2, y: S[i].y2 };

  for (let i = 0; i < S.length; i++)
    for (const end of [0, 1] as const) {
      const here = at(i, end);
      const base = {
        seg: i,
        end,
        at: here,
        short: isShort(i),
      };
      if (!usable(i)) {
        decisions.push({
          ...base,
          state: "isolated",
          candidates: [],
          reasons: ["DEGENERATE_SEGMENT"],
        });
        continue;
      }
      const s = S[i];
      const L = lens[i];
      const other = end === 0 ? { x: s.x2, y: s.y2 } : { x: s.x1, y: s.y1 };
      const ux = (here.x - other.x) / L;
      const uy = (here.y - other.y) / L;
      const reasons: string[] = base.short ? ["SHORT_SEGMENT"] : [];
      let contact = false;
      const cands: TopologyCandidate[] = [];

      for (const j of nb[i]) {
        if (!usable(j)) continue;
        evaluated++;
        const t = S[j];
        const lj = lens[j];
        const vx = (t.x2 - t.x1) / lj;
        const vy = (t.y2 - t.y1) / lj;
        const tt = Math.max(
          0,
          Math.min(1, ((here.x - t.x1) * vx + (here.y - t.y1) * vy) / lj),
        );
        const dseg = Math.hypot(
          here.x - (t.x1 + tt * lj * vx),
          here.y - (t.y1 + tt * lj * vy),
        );
        if (dseg <= e) {
          contact = true;
          continue;
        }
        const cross = ux * vy - uy * vx;
        const dot = ux * vx + uy * vy;
        const angle =
          (Math.atan2(Math.abs(cross), Math.abs(dot)) * 180) / Math.PI;
        const shortTarget = isShort(j);
        const rs: string[] = [];
        if (shortTarget) rs.push("SHORT_TARGET");

        if (angle < minAngle - 1e-9) {
          // Near-parallel: only a collinear continuation is a candidate.
          const a1 = (t.x1 - here.x) * ux + (t.y1 - here.y) * uy;
          const a2 = (t.x2 - here.x) * ux + (t.y2 - here.y) * uy;
          const near = Math.min(a1, a2);
          const far = Math.max(a1, a2);
          if (!(near > e && far > 0)) continue; // overlap / behind: ordinary, not a gap
          const off = Math.abs((here.x - t.x1) * vy - (here.y - t.y1) * vx);
          if (!within(near, off, band)) continue;
          const nearEnd: 0 | 1 = Math.abs(a1) <= Math.abs(a2) ? 0 : 1;
          const inTol = within(near, off, tol);
          if (angle > COLLINEAR_ANGLE_MAX_DEG) rs.push("ANGLE_BELOW_MIN");
          if (!inTol) rs.push("OUT_OF_TOLERANCE");
          cands.push({
            target: j,
            targetEnd: nearEnd,
            kind: "COLLINEAR",
            extension: near,
            slack: off,
            total: Math.hypot(near, off),
            angleDeg: angle,
            point: nearEnd === 0 ? { x: t.x1, y: t.y1 } : { x: t.x2, y: t.y2 },
            overshoot: false,
            inTolerance: inTol && rs.length === 0,
            reasons: rs,
          });
          continue;
        }
        const sExt = ((t.x1 - here.x) * vy - (t.y1 - here.y) * vx) / cross;
        const X = { x: here.x + sExt * ux, y: here.y + sExt * uy };
        const tj = (X.x - t.x1) * vx + (X.y - t.y1) * vy;
        const slack = tj < 0 ? -tj : tj > lj ? tj - lj : 0;
        const ext = Math.abs(sExt);
        if (!within(ext, slack, band)) continue;
        const atEnd =
          slack > 0 || Math.min(Math.abs(tj), Math.abs(tj - lj)) <= tol;
        const inTol = within(ext, slack, tol);
        if (!inTol) rs.push("OUT_OF_TOLERANCE");
        cands.push({
          target: j,
          kind: atEnd ? "L" : "T",
          extension: ext,
          slack,
          total: Math.hypot(ext, slack),
          angleDeg: angle,
          point: X,
          overshoot: sExt < 0,
          inTolerance: inTol && !shortTarget,
          reasons: rs,
        });
      }
      sortCandidates(cands);

      if (contact) {
        decisions.push({
          ...base,
          state: "satisfied",
          candidates: [],
          reasons: [...reasons, "CONTACT"],
        });
        continue;
      }
      if (cands.some((c) => c.inTolerance && c.overshoot && c.slack <= e)) {
        decisions.push({
          ...base,
          state: "satisfied",
          candidates: cands,
          reasons: [...reasons, "OVERSHOOT_CROSSES"],
        });
        continue;
      }
      const inTolC = cands.filter((c) => c.inTolerance);
      const junctions = inTolC.filter((c) => c.kind !== "COLLINEAR");
      if (junctions.length)
        for (const c of cands)
          if (c.kind === "COLLINEAR" && c.inTolerance)
            c.reasons.push("SUPERSEDED_BY_JUNCTION");
      const use = junctions.length ? junctions : inTolC;
      if (use.length === 0) {
        decisions.push({
          ...base,
          state: cands.length ? "report-only" : "isolated",
          candidates: cands,
          reasons: [...reasons, ...(cands.length ? [] : ["NO_CANDIDATE"])],
        });
        continue;
      }
      const pts = clusterPoints(
        use.map((c) => c.point),
        e * 10,
      ).reps;
      decisions.push({
        ...base,
        state: pts.length === 1 ? "unique" : "ambiguous",
        candidates: cands,
        reasons:
          pts.length === 1
            ? reasons
            : [...reasons, "AMBIGUOUS_JUNCTION_POINTS"],
        ...(pts.length === 1 ? { junctionPoint: pts[0] } : {}),
      });
    }

  // ---- Pass 2: partner / mutual rules, as a greatest fixpoint over the
  // decisions already made (no new candidates are discovered, so a connection
  // that was only inferred cannot create further ones: no transitive closure).
  const idx = (i: number, end: 0 | 1) => i * 2 + end;
  const usedOf = (d: EndpointDecision) => {
    const inT = d.candidates.filter((c) => c.inTolerance);
    const j = inT.filter((c) => c.kind !== "COLLINEAR");
    return j.length ? j : inT;
  };
  for (let round = 0; round < decisions.length + 1; round++) {
    const fail = new Map<number, string>();
    decisions.forEach((d, k) => {
      if (d.state !== "unique") return;
      const use = usedOf(d);
      if (use.every((c) => c.kind === "COLLINEAR")) {
        const c = use[0];
        const pd = decisions[idx(c.target, c.targetEnd!)];
        const back =
          pd.state === "unique" &&
          usedOf(pd).every((x) => x.kind === "COLLINEAR") &&
          usedOf(pd).some((x) => x.target === d.seg && x.targetEnd === d.end);
        if (!back) fail.set(k, "NOT_MUTUAL");
        return;
      }
      for (const c of use) {
        if (c.kind !== "L" || c.slack <= e) continue;
        const t = S[c.target];
        const d0 = Math.hypot(t.x1 - c.point.x, t.y1 - c.point.y);
        const d1 = Math.hypot(t.x2 - c.point.x, t.y2 - c.point.y);
        const pd = decisions[idx(c.target, d0 <= d1 ? 0 : 1)];
        if (!(
          pd.state === "unique" &&
          pd.junctionPoint &&
          d.junctionPoint &&
          close(pd.junctionPoint, d.junctionPoint, e * 10)
        )) {
          fail.set(k, "PARTNER_UNRESOLVED");
          return;
        }
      }
    });
    if (fail.size === 0) break;
    for (const [k, why] of fail) {
      const d = decisions[k];
      d.state = "report-only";
      d.reasons = [...d.reasons, why];
      delete d.junctionPoint;
    }
  }

  // ---- Junction nodes from the surviving unique decisions.
  const nodes: JunctionNode[] = [];
  const uniq = decisions.filter((d) => d.state === "unique");
  const jDec = uniq.filter((d) =>
    usedOf(d).some((c) => c.kind !== "COLLINEAR"),
  );
  const clusters = clusterPoints(
    jDec.map((d) => d.junctionPoint!),
    e * 10,
  );
  const reps = clusters.reps;
  const byCluster: EndpointDecision[][] = reps.map(() => []);
  jDec.forEach((d, k) => byCluster[clusters.of[k]].push(d));
  const horiz = (s: Seg) =>
    Math.abs(s.y2 - s.y1) <= AXIS_TOL && Math.abs(s.x2 - s.x1) > AXIS_TOL;
  const vert = (s: Seg) =>
    Math.abs(s.x2 - s.x1) <= AXIS_TOL && Math.abs(s.y2 - s.y1) > AXIS_TOL;
  const canonOf = (s: Seg) =>
    s.x1 < s.x2 || (s.x1 === s.x2 && s.y1 <= s.y2)
      ? { x: s.x1, y: s.y1 }
      : { x: s.x2, y: s.y2 };
  const pending: Omit<JunctionNode, "id">[] = [];
  for (const [repIdx, rep] of reps.entries()) {
    const mine = byCluster[repIdx];
    const hosts = new Set<number>();
    const xs: number[] = [];
    const ys: number[] = [];
    for (const d of mine) {
      const use = usedOf(d).filter((c) => c.kind !== "COLLINEAR");
      use.forEach((c) => hosts.add(c.target));
      const src = S[d.seg];
      const tg = use.map((c) => S[c.target]);
      if (horiz(src) && tg.every(vert))
        xs.push(Math.min(...tg.map((t) => canonOf(t).x)));
      else if (vert(src) && tg.every(horiz))
        ys.push(Math.min(...tg.map((t) => canonOf(t).y)));
    }
    const point = {
      x: xs.length ? Math.min(...xs) : rep.x,
      y: ys.length ? Math.min(...ys) : rep.y,
    };
    pending.push({
      kind: "junction",
      point,
      canonical: xs.length > 0 || ys.length > 0,
      endpoints: mine
        .map((d) => ({ seg: d.seg, end: d.end }))
        .sort((a, b) => a.seg - b.seg || a.end - b.end),
      hosts: [...hosts].sort((a, b) => a - b),
    });
  }
  const bridgeSeen = new Set<string>();
  for (const d of uniq) {
    const use = usedOf(d);
    if (!use.every((c) => c.kind === "COLLINEAR")) continue;
    const c = use[0];
    const a: EndpointRef = { seg: d.seg, end: d.end };
    const b: EndpointRef = { seg: c.target, end: c.targetEnd! };
    const [p, q] =
      a.seg < b.seg || (a.seg === b.seg && a.end < b.end) ? [a, b] : [b, a];
    const k = `${p.seg}.${p.end}|${q.seg}.${q.end}`;
    if (bridgeSeen.has(k)) continue;
    bridgeSeen.add(k);
    const pa = at(p.seg, p.end);
    const pb = at(q.seg, q.end);
    pending.push({
      kind: "bridge",
      point: { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 },
      canonical: false,
      endpoints: [p, q],
      hosts: [],
    });
  }
  pending.sort(
    (a, b) =>
      (a.kind === b.kind ? 0 : a.kind === "junction" ? -1 : 1) ||
      a.point.x - b.point.x ||
      a.point.y - b.point.y ||
      a.endpoints[0].seg - b.endpoints[0].seg,
  );
  pending.forEach((n, id) => {
    nodes.push({ id, ...n });
    for (const r of n.endpoints) decisions[idx(r.seg, r.end)].nodeId = id;
  });

  const count = (st: EndpointState) =>
    decisions.filter((d) => d.state === st).length;
  return {
    config: {
      connectionToleranceFt: tol,
      reportBandFt: band,
      minJunctionAngleDeg: minAngle,
      shortSegmentFt: shortFt,
      epsilon: e,
      bruteForce: brute,
    },
    segments: S,
    provenance: structuredClone(provenance),
    decisions,
    nodes,
    counts: {
      segments: S.length,
      endpoints: decisions.length,
      satisfied: count("satisfied"),
      unique: count("unique"),
      ambiguous: count("ambiguous"),
      reportOnly: count("report-only"),
      isolated: count("isolated"),
      shortSegments: S.filter((_, i) => isShort(i)).length,
      nodes: nodes.length,
      candidatePairsEvaluated: evaluated,
      indexPairs: pairs,
    },
  };
}
