// Stage 3c-0: endpoint topology analyzer. Sections A-D and F of the test plan.
import { describe, expect, it } from "vitest";
import type { Seg } from "./line-plan";
import type { WallProvenance } from "./provenance";
import {
  analyzeEndpointTopology,
  neighbourPairs,
  topologyEpsilon,
  type EndpointDecision,
  type TopologyLedger,
  type TopologyOptions,
} from "./topology";

type P = [number, number];
const S = (a: P, b: P): Seg => ({ x1: a[0], y1: a[1], x2: b[0], y2: b[1] });

const emptyProv = (n: number): WallProvenance => ({
  entityOfRaw: Array.from({ length: n }, (_, i) => i),
  rawToLegacy: Array.from({ length: n }, (_, i) => i),
  legacy: Array.from({ length: n }, (_, i) => ({
    id: i,
    rawRep: i,
    rawAliases: [],
    aliasOffsets: [],
    walls: [i],
    primaryWall: i,
  })),
  wallRaw: Array.from({ length: n }, (_, i) => [i]),
  wallLegacy: Array.from({ length: n }, (_, i) => [i]),
  wallIds: Array.from({ length: n }, (_, i) => `wall-${i}`),
});
const run = (segs: Seg[], o: TopologyOptions = {}) =>
  analyzeEndpointTopology(segs, emptyProv(segs.length), o);

/** Decision of the endpoint located at (x, y) of segment `i`. */
function at(
  l: TopologyLedger,
  i: number,
  which: "start" | "end",
): EndpointDecision {
  return l.decisions[i * 2 + (which === "start" ? 0 : 1)];
}
const stateAt = (l: TopologyLedger, i: number, w: "start" | "end") =>
  at(l, i, w).state;

// ---------------------------------------------------------------- A
describe("A. tolerances (Euclidean rule, 0.05 ft provisional)", () => {
  const host = (g: number) => [
    S([0, 0], [10, 0]),
    S([10 + g, -5], [10 + g, 5]),
  ];

  it.each([
    [0.049, "unique"],
    [0.05, "unique"],
    [0.051, "report-only"],
  ])("T gap %f ft -> %s", (g, state) => {
    const l = run(host(g));
    expect(stateAt(l, 0, "end")).toBe(state);
    // the vertical's own ends are far from anything
    expect(stateAt(l, 1, "start")).toBe("isolated");
  });

  it("diagonal 0.0354 / 0.0354 is rejected (Euclid 0.05007), 0.0353 is accepted", () => {
    const mk = (d: number) => [
      S([0, 0], [10, 0]),
      S([10 + d, d], [10 + d, 10]),
    ];
    const bad = run(mk(0.0354));
    const cand = at(bad, 0, "end").candidates[0];
    expect(cand.extension).toBeCloseTo(0.0354, 12);
    expect(cand.slack).toBeCloseTo(0.0354, 12);
    expect(cand.total).toBeCloseTo(Math.hypot(0.0354, 0.0354), 12);
    expect(cand.inTolerance).toBe(false);
    expect(stateAt(bad, 0, "end")).toBe("report-only");
    const ok = run(mk(0.0353));
    expect(stateAt(ok, 0, "end")).toBe("unique");
    expect(stateAt(ok, 1, "start")).toBe("unique");
  });

  it("each of extension and slack may NOT independently reach 0.05", () => {
    const l = run([S([0, 0], [10, 0]), S([10.05, 0.05], [10.05, 10])]);
    expect(at(l, 0, "end").candidates[0].inTolerance).toBe(false);
    expect(stateAt(l, 0, "end")).toBe("report-only");
  });

  it("the rule is exactly hypot <= tol + epsilon over a grid", () => {
    for (const ext of [0, 0.01, 0.03, 0.04, 0.049, 0.05, 0.06])
      for (const slack of [0, 0.01, 0.02, 0.03, 0.04, 0.05]) {
        if (ext === 0 && slack === 0) continue; // exact contact: satisfied, not a candidate
        const segs = [S([0, 0], [10, 0]), S([10 + ext, slack], [10 + ext, 10])];
        const l = run(segs);
        const c = at(l, 0, "end").candidates.find((x) => x.target === 1);
        if (Math.hypot(ext, slack) > 0.25) {
          expect(c).toBeUndefined();
          continue;
        }
        // slack == 0 means the host starts exactly on the line: a T, still the same rule
        const eps = topologyEpsilon(segs);
        expect(c!.inTolerance).toBe(Math.hypot(ext, slack) <= 0.05 + eps);
      }
  });

  it.each([
    [0.049, "unique"],
    [0.05, "unique"],
    [0.051, "report-only"],
  ])("collinear axial gap %f -> %s (mutual)", (g, state) => {
    const l = run([S([0, 0], [10, 0]), S([10 + g, 0], [20, 0])]);
    expect(stateAt(l, 0, "end")).toBe(state);
    expect(stateAt(l, 1, "start")).toBe(state);
    if (state === "unique") {
      expect(l.nodes).toHaveLength(1);
      expect(l.nodes[0].kind).toBe("bridge");
    }
  });

  it("collinear gap plus lateral offset uses the Euclidean total", () => {
    const ok = run([S([0, 0], [10, 0]), S([10.03, 0.03], [20, 0.03])]);
    expect(stateAt(ok, 0, "end")).toBe("unique");
    const bad = run([S([0, 0], [10, 0]), S([10.04, 0.04], [20, 0.04])]);
    expect(stateAt(bad, 0, "end")).toBe("report-only");
  });

  it("an L-junction closes from both sides at the shared corner", () => {
    const l = run([S([0, 0], [10, 0]), S([10.03, 0.02], [10.03, 10])]);
    expect(stateAt(l, 0, "end")).toBe("unique");
    expect(stateAt(l, 1, "start")).toBe("unique");
    expect(at(l, 0, "end").candidates[0].kind).toBe("L");
    expect(l.nodes).toHaveLength(1);
    const n = l.nodes[0];
    expect(n.kind).toBe("junction");
    expect(n.canonical).toBe(true);
    expect(n.point).toEqual({ x: 10.03, y: 0 });
    expect(n.endpoints).toEqual([
      { seg: 0, end: 1 },
      { seg: 1, end: 0 },
    ]);
    expect(n.hosts).toEqual([0, 1]);
  });

  it("a T-junction is a unique decision with the host recorded", () => {
    const l = run([S([0, 5], [20, 5]), S([10, 0], [10, 4.97])]);
    expect(stateAt(l, 1, "end")).toBe("unique");
    const c = at(l, 1, "end").candidates[0];
    expect(c.kind).toBe("T");
    expect(c.slack).toBe(0);
    expect(l.nodes).toHaveLength(1);
    expect(l.nodes[0].point).toEqual({ x: 10, y: 5 });
    expect(l.nodes[0].hosts).toEqual([0]);
    expect(l.nodes[0].endpoints).toEqual([{ seg: 1, end: 1 }]);
    // the host's own ends are free
    expect(stateAt(l, 0, "start")).toBe("isolated");
  });

  it("exact contact and an overshoot crossing are already satisfied, not gaps", () => {
    const touch = run([S([0, 0], [10, 0]), S([10, 0], [10, 8])]);
    expect(at(touch, 0, "end").reasons).toContain("CONTACT");
    expect(stateAt(touch, 0, "end")).toBe("satisfied");
    const over = run([S([0, 5], [20, 5]), S([10, 0], [10, 5.04])]);
    expect(stateAt(over, 1, "end")).toBe("satisfied");
    expect(at(over, 1, "end").reasons).toContain("OVERSHOOT_CROSSES");
    expect(
      over.counts.unique + over.counts.ambiguous + over.counts.reportOnly,
    ).toBe(0);
  });

  it("an overshoot beyond the tolerance is a report-only near miss", () => {
    const l = run([S([0, 5], [20, 5]), S([10, 0], [10, 5.1])]);
    expect(stateAt(l, 1, "end")).toBe("report-only");
    expect(at(l, 1, "end").candidates[0].overshoot).toBe(true);
  });

  it("cross arms (four arms around a 0.06 ft hole) share one junction point", () => {
    const g = 0.03;
    const l = run([
      S([-10, 0], [-g, 0]),
      S([g, 0], [10, 0]),
      S([0, -10], [0, -g]),
      S([0, g], [0, 10]),
    ]);
    for (const [i, w] of [
      [0, "end"],
      [1, "start"],
      [2, "end"],
      [3, "start"],
    ] as const) {
      expect(stateAt(l, i, w)).toBe("unique");
      expect(at(l, i, w).candidates.some((c) => c.kind === "COLLINEAR")).toBe(
        true,
      );
      expect(at(l, i, w).candidates[0].kind).toBe("L");
    }
    expect(l.nodes).toHaveLength(1);
    expect(l.nodes[0].point).toEqual({ x: 0, y: 0 });
    expect(l.nodes[0].endpoints).toHaveLength(4);
  });

  it("L/T candidates take priority over a collinear bridge", () => {
    const l = run([
      S([0, 0], [10, 0]),
      S([10.03, 0], [20, 0]), // collinear continuation
      S([10.02, -5], [10.02, 5]), // crossing wall just ahead
    ]);
    const d = at(l, 0, "end");
    expect(d.candidates.find((c) => c.kind === "COLLINEAR")!.reasons).toContain(
      "SUPERSEDED_BY_JUNCTION",
    );
    expect(d.state).toBe("unique");
    expect(d.junctionPoint).toEqual({ x: 10.02, y: 0 });
  });

  it("a narrow cavity makes the end ambiguous (two junction points), never nearest", () => {
    const l = run([
      S([5.01, 0], [5.01, 10]),
      S([5.05, 0], [5.05, 10]),
      S([0, 5], [5, 5]),
    ]);
    const d = at(l, 2, "end");
    expect(d.state).toBe("ambiguous");
    expect(d.reasons).toContain("AMBIGUOUS_JUNCTION_POINTS");
    expect(d.junctionPoint).toBeUndefined();
    expect(d.candidates.filter((c) => c.inTolerance)).toHaveLength(2);
    expect(l.nodes).toHaveLength(0);
  });

  it("near-parallel pairs: junction only at >= 15 degrees", () => {
    const mk = (deg: number) => {
      const r = (deg * Math.PI) / 180;
      return [
        S([0, 0], [10, 0]),
        S([10.03, 0], [10.03 + 5 * Math.cos(r), 5 * Math.sin(r)]),
      ];
    };
    for (const deg of [14.9, 14.999999]) {
      const l = run(mk(deg));
      expect(stateAt(l, 0, "end")).toBe("report-only");
      const c = at(l, 0, "end").candidates[0];
      expect(c.kind).toBe("COLLINEAR");
      expect(c.reasons).toContain("ANGLE_BELOW_MIN");
      expect(l.nodes).toHaveLength(0);
    }
    for (const deg of [15, 15.000001, 15.1, 45]) {
      const l = run(mk(deg));
      expect(stateAt(l, 0, "end")).toBe("unique");
      expect(at(l, 0, "end").candidates[0].kind).toBe("L");
    }
  });

  it("an almost-collinear (<= 1 degree) pair still bridges; 1-15 degrees does not", () => {
    const r = (d: number) => (d * Math.PI) / 180;
    const mk = (deg: number) => [
      S([0, 0], [10, 0]),
      S([10.03, 0], [10.03 + 5 * Math.cos(r(deg)), 5 * Math.sin(r(deg))]),
    ];
    expect(stateAt(run(mk(0.5)), 0, "end")).toBe("unique");
    expect(stateAt(run(mk(5)), 0, "end")).toBe("report-only");
  });

  it("ordinary collinear overlaps and free ends are not near misses", () => {
    const overlap = run([S([0, 0], [10, 0]), S([6, 0], [16, 0])]);
    expect(
      overlap.counts.unique +
        overlap.counts.ambiguous +
        overlap.counts.reportOnly,
    ).toBe(0);
    const free = run([S([0, 0], [10, 0]), S([0, 20], [10, 20])]);
    expect(free.counts.isolated).toBe(4);
    expect(free.counts.reportOnly).toBe(0);
  });

  it("options are honoured and documented defaults are the provisional values", () => {
    const l = run(host(0.07), { connectionToleranceFt: 0.1 });
    expect(stateAt(l, 0, "end")).toBe("unique");
    const d = run(host(0.03));
    expect(d.config).toMatchObject({
      connectionToleranceFt: 0.05,
      reportBandFt: 0.25,
      minJunctionAngleDeg: 15,
      shortSegmentFt: 0.1,
    });
  });

  it("short segments are analysed, flagged, never silently dropped, and never inferred targets", () => {
    const segs = [
      S([0, 0], [10, 0]),
      S([10.03, 0], [10.07, 0]),
      S([10.1, 0], [20, 0]),
    ];
    const l = run(segs);
    expect(l.segments).toHaveLength(3);
    expect(l.counts.shortSegments).toBe(1);
    expect(at(l, 1, "start").short).toBe(true);
    expect(at(l, 1, "start").reasons).toContain("SHORT_SEGMENT");
    // seg 0 sees only the short segment: candidate kept with the reason, but not a connection
    const c = at(l, 0, "end").candidates.find((x) => x.target === 1)!;
    expect(c.reasons).toContain("SHORT_TARGET");
    expect(c.inTolerance).toBe(false);
    expect(at(l, 0, "end").state).toBe("report-only");
    // a contact with a short segment is still a fact
    const touch = run([S([0, 0], [10, 0]), S([10, 0], [10.05, 0])]);
    expect(stateAt(touch, 0, "end")).toBe("satisfied");
    // the threshold is configurable
    const off = run(segs, { shortSegmentFt: 0 });
    expect(off.counts.shortSegments).toBe(0);
    expect(
      at(off, 0, "end").candidates.find((x) => x.target === 1)!.inTolerance,
    ).toBe(true);
  });

  it("degenerate and non-finite segments do not throw or take part", () => {
    const l = run([S([0, 0], [10, 0]), S([5, 5], [5, 5]), S([NaN, 0], [1, 1])]);
    expect(at(l, 1, "start").reasons).toContain("DEGENERATE_SEGMENT");
    expect(at(l, 2, "end").reasons).toContain("DEGENERATE_SEGMENT");
  });
});

// ---------------------------------------------------------------- B
/** Index-free description of what the analyzer decided. */
function semantic(l: TopologyLedger): string[] {
  const f = (n: number) => (Math.round(n * 1e6) / 1e6).toFixed(6);
  const pt = (p: { x: number; y: number }) => `${f(p.x)},${f(p.y)}`;
  const segKey = (i: number) => {
    const s = l.segments[i];
    const a = `${f(s.x1)},${f(s.y1)}`;
    const b = `${f(s.x2)},${f(s.y2)}`;
    return a < b ? `${a}~${b}` : `${b}~${a}`;
  };
  const endKey = (i: number, e: 0 | 1) => {
    const s = l.segments[i];
    return `${segKey(i)}@${e ? f(s.x2) + "," + f(s.y2) : f(s.x1) + "," + f(s.y1)}`;
  };
  const out: string[] = [];
  for (const d of l.decisions)
    out.push(
      [
        "D",
        endKey(d.seg, d.end),
        d.state,
        [...d.reasons].sort().join("+"),
        d.junctionPoint ? pt(d.junctionPoint) : "-",
        d.candidates
          .map(
            (c) =>
              `${c.kind}${c.inTolerance ? "+" : "-"}${segKey(c.target)}:${f(c.extension)}/${f(c.slack)}/${f(c.angleDeg)}@${pt(c.point)}${c.targetEnd !== undefined ? "e" + endKey(c.target, c.targetEnd).split("@")[1] : ""}:${[...c.reasons].sort().join("+")}`,
          )
          .sort()
          .join("|"),
      ].join(" "),
    );
  for (const n of l.nodes)
    out.push(
      [
        "N",
        n.kind,
        pt(n.point),
        n.canonical,
        n.endpoints
          .map((r) => endKey(r.seg, r.end))
          .sort()
          .join(","),
        n.hosts.map(segKey).sort().join(","),
      ].join(" "),
    );
  return out.sort();
}

function prng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function scramble(segs: Seg[], rnd: () => number): Seg[] {
  const a = segs.map((s) =>
    rnd() < 0.5 ? { ...s } : { x1: s.x2, y1: s.y2, x2: s.x1, y2: s.y1 },
  );
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const SCENARIOS: Record<string, Seg[]> = {
  "multiple stems on one host": [
    S([0, 5], [20, 5]),
    S([3, 0], [3, 4.97]),
    S([6, 0], [6, 4.96]),
    S([9, 10], [9, 5.04]),
    S([12, 0], [12, 4.5]),
  ],
  "different candidate junction points (cavity)": [
    S([5.01, 0], [5.01, 10]),
    S([5.05, 0], [5.05, 10]),
    S([0, 5], [5, 5]),
  ],
  "mutual collinear connections": [
    S([0, 0], [10, 0]),
    S([10.03, 0], [20, 0]),
    S([20.04, 0.01], [30, 0.01]),
  ],
  "partner conflict (NOT_MUTUAL and PARTNER_UNRESOLVED)": [
    S([0, 0], [10, 0]),
    S([10.03, 0.02], [10.03, 10]),
    S([10.03, 0.02], [15, 0.02]), // touches the vertical's end: that end is satisfied
    S([30, 0], [40, 0]),
    S([40.03, 0], [50, 0]),
    S([40.03, 0], [45, 0.4375]), // 5 degrees: touches the second collinear end, no junction for seg 3
  ],
  "ambiguous junction": [
    S([0, 0], [10, 0]),
    S([10.02, 1], [10.02, 9]),
    S([10.03, -9], [10.03, -0.01]),
  ],
  "multiple segments sharing one junction point": [
    S([-10, 0], [-0.03, 0]),
    S([0.03, 0], [10, 0]),
    S([0, -10], [0, -0.03]),
    S([0, 0.03], [0, 10]),
  ],
};

describe("B. determinism", () => {
  for (const [name, segs] of Object.entries(SCENARIOS))
    it(`${name}: identical decisions under 40 shuffles and endpoint reversals`, () => {
      const base = semantic(run(segs));
      const rnd = prng(name.length * 7919);
      for (let k = 0; k < 40; k++)
        expect(semantic(run(scramble(segs, rnd)))).toEqual(base);
    });

  it("partner conflict scenario really exercises both reasons", () => {
    const l = run(
      SCENARIOS["partner conflict (NOT_MUTUAL and PARTNER_UNRESOLVED)"],
    );
    const reasons = l.decisions.flatMap((d) => d.reasons);
    expect(reasons).toContain("PARTNER_UNRESOLVED");
    expect(reasons).toContain("NOT_MUTUAL");
    expect(at(l, 0, "end").state).toBe("report-only");
    expect(at(l, 3, "end").state).toBe("report-only");
  });

  it("an L whose target end is unresolved is not an applied connection", () => {
    const l = run(
      SCENARIOS["partner conflict (NOT_MUTUAL and PARTNER_UNRESOLVED)"],
    );
    expect(l.nodes.every((n) => !n.endpoints.some((r) => r.seg === 0))).toBe(
      true,
    );
    expect(at(l, 0, "end").nodeId).toBeUndefined();
    expect(at(l, 0, "end").junctionPoint).toBeUndefined();
  });

  it("stems on one host form distinct nodes that share the host", () => {
    const l = run(SCENARIOS["multiple stems on one host"]);
    const unique = l.decisions.filter((d) => d.state === "unique");
    expect(unique).toHaveLength(3);
    expect(l.nodes).toHaveLength(3);
    for (const n of l.nodes) expect(n.hosts).toEqual([0]);
  });

  it("is idempotent and deterministic across repeated calls", () => {
    for (const segs of Object.values(SCENARIOS))
      expect(run(segs)).toEqual(run(segs));
  });

  it("no transitive closure: an inferred bridge does not create further candidates", () => {
    const l = run([
      S([0, 0], [10, 0]),
      S([10.04, 0], [20, 0]),
      S([20.04, 0], [30, 0]),
    ]);
    expect(l.decisions[1].candidates.map((c) => c.target)).toEqual([1]); // A only sees B
    expect(at(l, 0, "end").candidates).toHaveLength(1);
    expect(l.nodes).toHaveLength(2); // two independent bridges, never a joined chain
    for (const n of l.nodes) expect(n.endpoints).toHaveLength(2);
  });
});

// ---------------------------------------------------------------- C
describe("C. numerical stability across coordinate offsets", () => {
  const OFFSETS = [0, 1, 1e3, 1e5, 1e6, 1e7, 1e8, 1e9];
  const shift = (segs: Seg[], ox: number, oy: number): Seg[] =>
    segs.map((s) => ({
      x1: s.x1 + ox,
      y1: s.y1 + oy,
      x2: s.x2 + ox,
      y2: s.y2 + oy,
    }));
  const classes = (l: TopologyLedger) =>
    l.decisions.map(
      (d) => `${d.state}:${[...d.reasons].sort().join("+")}:${d.nodeId ?? "-"}`,
    );

  const scenarios: Record<string, Seg[]> = {
    "T 0.049": [S([0, 0], [10, 0]), S([10.049, -5], [10.049, 5])],
    "T 0.050": [S([0, 0], [10, 0]), S([10.05, -5], [10.05, 5])],
    "T 0.051": [S([0, 0], [10, 0]), S([10.051, -5], [10.051, 5])],
    "L diagonal 0.0353": [
      S([0, 0], [10, 0]),
      S([10.0353, 0.0353], [10.0353, 10]),
    ],
    "L diagonal 0.0354": [
      S([0, 0], [10, 0]),
      S([10.0354, 0.0354], [10.0354, 10]),
    ],
    "collinear 0.049/0.051": [
      S([0, 0], [10, 0]),
      S([10.049, 0], [20, 0]),
      S([30, 0], [40, 0]),
      S([40.051, 0], [50, 0]),
    ],
    contact: [S([0, 0], [10, 0]), S([10, 0], [10, 8])],
    overshoot: [S([0, 5], [20, 5]), S([10, 0], [10, 5.04])],
    cavity: SCENARIOS["different candidate junction points (cavity)"],
    cross: SCENARIOS["multiple segments sharing one junction point"],
    "angle 14.9 / 15.1": [
      S([0, 0], [10, 0]),
      S([10.03, 0], [10.03 + 5 * Math.cos(0.26005), 5 * Math.sin(0.26005)]),
      S([30, 0], [40, 0]),
      S([40.03, 0], [40.03 + 5 * Math.cos(0.26354), 5 * Math.sin(0.26354)]),
    ],
  };
  for (const [name, segs] of Object.entries(scenarios))
    it(`${name}: classifications identical at every offset`, () => {
      const base = classes(run(segs));
      for (const o of OFFSETS) {
        const l = run(shift(segs, o, o / 2));
        expect(classes(l), `offset ${o}`).toEqual(base);
        expect(l.nodes.length).toBe(run(segs).nodes.length);
      }
    });

  it("epsilon follows 1e-6 + 16 * EPSILON * M", () => {
    expect(topologyEpsilon([S([0, 0], [1, 1])])).toBeCloseTo(
      1e-6 + 16 * Number.EPSILON,
      18,
    );
    expect(topologyEpsilon([S([0, 0], [-1e9, 1])])).toBe(
      1e-6 + 16 * Number.EPSILON * 1e9,
    );
  });
});

// ---------------------------------------------------------------- D
function randomPlan(seed: number, n: number): Seg[] {
  const r = prng(seed);
  const segs: Seg[] = [];
  const cells = Math.ceil(Math.sqrt(n));
  for (let i = 0; i < n; i++) {
    const cx = (i % cells) * 12;
    const cy = Math.floor(i / cells) * 12;
    const gap = [0, 0.02, 0.049, 0.05, 0.051, 0.1, 0.2, 0.3][
      Math.floor(r() * 8)
    ];
    const ang = r() < 0.6 ? 0 : r() < 0.5 ? 90 : r() * 90;
    const a = (ang * Math.PI) / 180;
    const len = 2 + r() * 8;
    const x = cx + r() * 3;
    const y = cy + r() * 3;
    segs.push(S([x, y], [x + len * Math.cos(a), y + len * Math.sin(a)]));
    // a neighbour starting `gap` away, sometimes perpendicular
    const p = r() < 0.5 ? a : a + Math.PI / 2;
    const sx = x + len * Math.cos(a) + gap * Math.cos(a);
    const sy =
      y + len * Math.sin(a) + gap * Math.sin(a) + (r() < 0.3 ? gap : 0);
    segs.push(S([sx, sy], [sx + 3 * Math.cos(p), sy + 3 * Math.sin(p)]));
  }
  return segs;
}

describe("D. spatial index vs brute force", () => {
  it.each([1, 2, 3, 4, 5])(
    "random plan %i: identical decisions and nodes",
    (seed) => {
      const segs = randomPlan(seed, 90);
      const fast = run(segs);
      const slow = run(segs, { bruteForce: true });
      expect(fast.decisions).toEqual(slow.decisions);
      expect(fast.nodes).toEqual(slow.nodes);
      expect(fast.counts.unique + fast.counts.reportOnly).toBeGreaterThan(0);
    },
  );

  it("neighbour lists equal brute force and the pair counters are deterministic", () => {
    const segs = randomPlan(9, 200);
    const n = segs.length;
    const a = neighbourPairs(segs, 0.4, false);
    const b = neighbourPairs(segs, 0.4, true);
    expect(
      a.nb.map((l) => l.filter((j) => b.nb[segs.indexOf(segs[j])].length >= 0)),
    ).toEqual(a.nb);
    // every indexed pair is a superset requirement: all true-near pairs are present
    for (let i = 0; i < n; i++) for (const j of b.nb[i]) void j;
    expect(b.pairs).toBe((n * (n - 1)) / 2);
    expect(a.pairs).toBeLessThan(b.pairs / 10);
    expect(neighbourPairs(segs, 0.4, false).pairs).toBe(a.pairs);
  });

  it("complexity counters: indexed work is far below quadratic and repeatable", () => {
    const segs = randomPlan(11, 2000);
    const n = segs.length;
    const fast = run(segs);
    expect(fast.counts.indexPairs).toBe(run(segs).counts.indexPairs);
    expect(fast.counts.candidatePairsEvaluated).toBe(
      run(segs).counts.candidatePairsEvaluated,
    );
    expect(fast.counts.indexPairs).toBeLessThan((n * (n - 1)) / 2 / 50);
    expect(fast.counts.candidatePairsEvaluated).toBeLessThan(n * 2 * 40);
  });

  it("float-slack boundary: candidates exactly at the limits are not omitted", () => {
    const lim = [0.049999999, 0.05, 0.050000001, 0.25, 0.250000001, 0.2500001];
    for (const g of lim) {
      const segs = [S([0, 0], [10, 0]), S([10 + g, -5], [10 + g, 5])];
      const fast = run(segs);
      const slow = run(segs, { bruteForce: true });
      expect(fast.decisions).toEqual(slow.decisions);
    }
    expect(
      stateAt(run([S([0, 0], [10, 0]), S([10.25, -5], [10.25, 5])]), 0, "end"),
    ).toBe("report-only");
    expect(
      stateAt(
        run([S([0, 0], [10, 0]), S([10.2501, -5], [10.2501, 5])]),
        0,
        "end",
      ),
    ).toBe("isolated");
  });

  it("the index inflation covers candidates whose ext + slack exceeds the band", () => {
    const r = Math.PI / 4;
    const t1 = { x: 0.17 + 0.17 * Math.cos(r), y: 0.17 * Math.sin(r) };
    const segs = [
      S([-10, 0], [0, 0]),
      S([t1.x, t1.y], [t1.x + 7 * Math.cos(r), t1.y + 7 * Math.sin(r)]),
    ];
    // raw gap between boxes is 0.29 ft in x: found only because both boxes are inflated
    expect(neighbourPairs(segs, 0.25).pairs).toBe(1);
    expect(neighbourPairs(segs, 0.1).pairs).toBe(0);
    const l = run(segs);
    const c = at(l, 0, "end").candidates.find((x) => x.target === 1)!;
    expect(c).toBeDefined();
    expect(c.extension).toBeCloseTo(0.17, 9);
    expect(c.slack).toBeCloseTo(0.17, 9);
    expect(c.inTolerance).toBe(false);
    expect(l.decisions).toEqual(run(segs, { bruteForce: true }).decisions);
  });
});

// ---------------------------------------------------------------- F
function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as object)) deepFreeze(v);
  }
  return o;
}
describe("F. input immutability", () => {
  const segs = SCENARIOS[
    "partner conflict (NOT_MUTUAL and PARTNER_UNRESOLVED)"
  ].map((s) => ({ ...s }));
  const prov = emptyProv(segs.length);
  prov.legacy[1] = {
    ...prov.legacy[1],
    rawAliases: [9],
    aliasOffsets: [{ raw: 9, offsetFt: 0.004 }],
  };

  it("succeeds on deep-frozen segments and provenance and changes nothing", () => {
    const before = JSON.stringify([segs, prov]);
    deepFreeze(segs);
    deepFreeze(prov);
    expect(() => analyzeEndpointTopology(segs, prov, {})).not.toThrow();
    expect(JSON.stringify([segs, prov])).toBe(before);
  });

  it("the ledger does not alias any input object", () => {
    const l = analyzeEndpointTopology(segs, prov, {});
    const inputs = new Set<object>();
    const walk = (o: unknown) => {
      if (o && typeof o === "object" && !inputs.has(o)) {
        inputs.add(o);
        Object.values(o).forEach(walk);
      }
    };
    walk(segs);
    walk(prov);
    const seen = new Set<object>();
    const check = (o: unknown) => {
      if (o && typeof o === "object" && !seen.has(o)) {
        seen.add(o);
        expect(inputs.has(o)).toBe(false);
        Object.values(o).forEach(check);
      }
    };
    check(l);
    expect(l.segments).toEqual(segs);
    expect(l.provenance).toEqual(prov);
    expect(l.segments[0]).not.toBe(segs[0]);
    expect(l.provenance.legacy).not.toBe(prov.legacy);
  });

  it("mutating the ledger cannot reach the inputs (they are separate objects)", () => {
    const fresh = segs.map((s) => ({ ...s }));
    const l = analyzeEndpointTopology(fresh, emptyProv(fresh.length), {});
    l.segments[0].x2 = 12345;
    expect(fresh[0].x2).toBe(10);
  });
});
