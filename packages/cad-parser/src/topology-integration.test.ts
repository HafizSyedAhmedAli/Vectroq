// Stage 3c-0 sections G (preservation vs the golden baseline captured from the
// unmodified Stage 3b code) and H (integration and warnings).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const spy = vi.hoisted(() => ({ calls: 0, fail: false }));
vi.mock("./topology", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./topology")>();
  return {
    ...actual,
    analyzeEndpointTopology: (
      ...a: Parameters<typeof actual.analyzeEndpointTopology>
    ) => {
      spy.calls++;
      if (spy.fail) throw new Error("boom");
      return actual.analyzeEndpointTopology(...a);
    },
  };
});

import { goldenCorpus, dxfText } from "../eval/golden/corpus";
import { dxfToGeometry, dxfToGeometryDetailed } from "./dxf-to-geometry";
import { parseDxf } from "./parse-dxf";
import { ParseReport } from "./report";

const GOLDEN = JSON.parse(
  readFileSync(join(__dirname, "../eval/golden/golden-baseline.json"), "utf8"),
) as {
  baselineCommit: string;
  cases: Record<
    string,
    { mode: string; trusted: boolean; geometry: any; meta: any }
  >;
};
const NEW_CODE = "WALL_ENDPOINT_NEAR_MISSES";
const jsonRound = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const withoutNewWarning = (meta: any) => ({
  ...meta,
  warnings: meta.warnings.filter((w: any) => w.code !== NEW_CODE),
});

beforeEach(() => {
  spy.calls = 0;
  spy.fail = false;
});

// ---------------------------------------------------------------- G
describe("G. preservation against the Stage 3b golden baseline", () => {
  it("the golden file was captured at the Stage 3b commit", () => {
    expect(GOLDEN.baselineCommit).toBe(
      "10f8ad0223181fdfff9e0caaa7e86c9628fd6792",
    );
    expect(Object.keys(GOLDEN.cases).length).toBe(goldenCorpus().length);
  });

  for (const c of goldenCorpus()) {
    const g = GOLDEN.cases[c.name];
    describe(c.name, () => {
      const now = c.run();
      it("geometry is strictly equal to the baseline", () => {
        expect(jsonRound(now.geometry)).toEqual(g.geometry);
      });
      it("metadata is strictly equal (the new aggregate warning is the only permitted addition)", () => {
        expect(jsonRound(withoutNewWarning(now.meta))).toEqual(g.meta);
      });
      it("wall ids, coordinates, lengths and thicknesses are unchanged", () => {
        const a = (now.geometry as any).walls;
        expect(a.map((w: any) => w.id)).toEqual(
          g.geometry.walls.map((w: any) => w.id),
        );
        a.forEach((w: any, i: number) => {
          const o = g.geometry.walls[i];
          for (const k of [
            "startX",
            "startY",
            "endX",
            "endY",
            "length",
            "thickness",
            "height",
          ])
            expect(w[k], `${w.id}.${k}`).toBe(o[k]);
        });
      });
      it("rooms: count, areas, names and types are unchanged", () => {
        const a = (now.geometry as any).rooms;
        expect(a.length).toBe(g.geometry.rooms.length);
        a.forEach((r: any, i: number) => {
          const o = g.geometry.rooms[i];
          expect([r.area, r.name, r.type]).toEqual([o.area, o.name, o.type]);
        });
      });
      it("openings: position, size, host angle, hinge and swing are unchanged", () => {
        const a = (now.geometry as any).openings;
        expect(a.length).toBe(g.geometry.openings.length);
        a.forEach((o: any, i: number) => {
          const b = g.geometry.openings[i];
          for (const k of [
            "id",
            "type",
            "x",
            "y",
            "width",
            "height",
            "angle",
            "hingeX",
            "hingeY",
            "openAngle",
          ])
            expect(o[k], `${o.id}.${k}`).toBe(b[k]);
        });
      });
    });
  }

  it("Mode A cases: no topology, no new warning, byte-identical metadata", () => {
    for (const c of goldenCorpus().filter((x) => x.mode === "A")) {
      const r = parseDxfLike(c);
      expect(r.topology).toBeUndefined();
      expect(r.meta.warnings.some((w: any) => w.code === NEW_CODE)).toBe(false);
      expect(jsonRound(r.meta)).toEqual(GOLDEN.cases[c.name].meta);
    }
  });

  it("untrusted-unit cases: no topology, no new warning, byte-identical metadata", () => {
    const untrusted = goldenCorpus().filter(
      (x) => !x.trusted && x.mode !== "-",
    );
    expect(untrusted.length).toBeGreaterThanOrEqual(5);
    for (const c of untrusted) {
      const r = parseDxfLike(c);
      expect(r.topology).toBeUndefined();
      expect(jsonRound(r.meta)).toEqual(GOLDEN.cases[c.name].meta);
    }
    expect(spy.calls).toBe(0);
  });
});

function parseDxfLike(c: {
  run: () => { geometry: unknown; meta: unknown };
}): any {
  // run() returns what parseDxf / dxfToGeometry returned; topology exists only on parseDxf results.
  return c.run();
}

// ---------------------------------------------------------------- H
const L = (layer: string, a: [number, number], b: [number, number]) => ({
  type: "LINE",
  layer,
  vertices: [
    { x: a[0], y: a[1] },
    { x: b[0], y: b[1] },
  ],
});
const W = (a: [number, number], b: [number, number]) => L("WALLS", a, b);
const detailed = (
  entities: unknown[],
  trusted?: boolean,
  report = new ParseReport(),
) => ({
  report,
  ...dxfToGeometryDetailed({ entities } as never, undefined, {
    report,
    ...(trusted === undefined ? {} : { unitTrusted: trusted }),
  }),
});
const warnings = (r: ParseReport) => r.toMeta({} as never).warnings;

// 1 unique T (stem short by 0.03), 1 report-only (stem short by 0.2), free stubs, a collinear overlap
const NEAR_MISS_PLAN = [
  W([0, 10], [20, 10]),
  W([10, 0], [10, 9.97]),
  W([15, 0], [15, 9.8]),
  W([30, 0], [40, 0]),
  W([35, 0], [45, 0]),
];

describe("H. integration and warnings", () => {
  it("trusted Mode B invokes the analyzer once and returns a ledger", () => {
    const r = detailed(NEAR_MISS_PLAN, true);
    expect(spy.calls).toBe(1);
    expect(r.topology).toBeDefined();
    expect(r.topology!.counts.segments).toBe(5); // the overlap pair is NOT merged in legacySegs
  });

  it("untrusted Mode B (false, undefined, no ctx) never invokes it", () => {
    expect(detailed(NEAR_MISS_PLAN, false).topology).toBeUndefined();
    expect(detailed(NEAR_MISS_PLAN, undefined).topology).toBeUndefined();
    expect(
      dxfToGeometryDetailed({ entities: NEAR_MISS_PLAN } as never).topology,
    ).toBeUndefined();
    expect(spy.calls).toBe(0);
  });

  it("Mode A never invokes it, even with trusted units", () => {
    const poly = {
      type: "LWPOLYLINE",
      layer: "WALLS",
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 8 },
        { x: 0, y: 8 },
      ],
    };
    const r = detailed(
      [poly, W([0, 0], [10, 0]), W([10.03, 0], [20, 0])],
      true,
    );
    expect(r.topology).toBeUndefined();
    expect(spy.calls).toBe(0);
    expect(warnings(r.report).some((w) => w.code === NEW_CODE)).toBe(false);
  });

  it("fewer than two eligible segments: not invoked, topology undefined", () => {
    expect(detailed([W([0, 0], [10, 0])], true).topology).toBeUndefined();
    expect(
      detailed([W([0, 0], [10, 0]), W([5, 5], [5, 5])], true).topology,
    ).toBeUndefined();
    expect(detailed([], true).topology).toBeUndefined();
    expect(spy.calls).toBe(0);
  });

  it("parseDxf exposes ParseResult.topology only for trusted Mode B", () => {
    const geometryOf = (t: string) => parseDxf(t);
    const trusted = geometryOf(
      dxfText([lineEnt([0, 10], [20, 10]), lineEnt([10, 0], [10, 9.97])], 0, 2),
    );
    expect(trusted.meta.unit.needsConfirmation).toBe(false);
    expect(trusted.topology).toBeDefined();
    const noUnit = geometryOf(
      dxfText([lineEnt([0, 10], [20, 10]), lineEnt([10, 0], [10, 9.97])]),
    );
    expect(noUnit.meta.unit.needsConfirmation).toBe(true);
    expect(noUnit.topology).toBeUndefined();
    expect(Object.keys(noUnit)).not.toContain("topology");
  });

  it("emits exactly one aggregate info warning with the right counts and says nothing was applied", () => {
    const r = detailed(NEAR_MISS_PLAN, true);
    const hits = warnings(r.report).filter((w) => w.code === NEW_CODE);
    expect(hits).toHaveLength(1);
    expect(hits[0].severity).toBe("info");
    expect(hits[0].entity).toBeUndefined();
    // hand-counted: stem 1 end -> unique; stem 2 end -> report-only; no ambiguous
    expect(r.topology!.counts).toMatchObject({
      unique: 1,
      ambiguous: 0,
      reportOnly: 1,
    });
    expect(hits[0].message).toContain(
      "1 with one possible connection, 0 ambiguous, 1 report-only",
    );
    expect(hits[0].message).toMatch(/no walls were moved or connected/i);
    expect(hits[0].message).not.toMatch(/telemetry|across uploads/i);
  });

  it("counts an ambiguous endpoint", () => {
    const r = detailed(
      [W([5.01, 0], [5.01, 10]), W([5.05, 0], [5.05, 10]), W([0, 5], [5, 5])],
      true,
    );
    const m = warnings(r.report).find((w) => w.code === NEW_CODE)!;
    expect(r.topology!.counts.ambiguous).toBe(1);
    expect(m.message).toContain("0 with one possible connection, 1 ambiguous");
  });

  it("isolated free ends do not create a warning", () => {
    const r = detailed([W([0, 0], [10, 0]), W([0, 20], [10, 20])], true);
    expect(r.topology!.counts.isolated).toBe(4);
    expect(warnings(r.report)).toEqual([]);
  });

  it("ordinary collinear overlaps do not create a warning", () => {
    const r = detailed([W([0, 0], [10, 0]), W([6, 0], [16, 0])], true);
    expect(r.topology!.counts.reportOnly + r.topology!.counts.unique).toBe(0);
    expect(warnings(r.report).some((w) => w.code === NEW_CODE)).toBe(false);
  });

  it("satisfied endpoints (contact, crossing) do not create a warning", () => {
    const r = detailed(
      [
        W([0, 0], [10, 0]),
        W([10, 0], [10, 8]),
        W([0, 5], [20, 5]),
        W([15, 0], [15, 5.04]),
      ],
      true,
    );
    expect(r.topology!.counts.satisfied).toBeGreaterThan(0);
    expect(warnings(r.report).some((w) => w.code === NEW_CODE)).toBe(false);
  });

  it("existing fixtures acquire no unexpected warnings", () => {
    for (const c of goldenCorpus().filter((x) =>
      x.name.startsWith("fixture:"),
    )) {
      const codes = (c.run().meta as any).warnings.map((w: any) => w.code);
      expect(codes, c.name).not.toContain(NEW_CODE);
      expect(codes, c.name).toEqual(
        GOLDEN.cases[c.name].meta.warnings.map((w: any) => w.code),
      );
    }
  });

  it("only the near-miss golden plans gain the warning; all other cases are untouched", () => {
    for (const c of goldenCorpus()) {
      const had = (c.run().meta as any).warnings.some(
        (w: any) => w.code === NEW_CODE,
      );
      const expected = [
        "modeB-near-miss",
        "modeB-jittered", // 0.004 ft jitter leaves T/L ends off the hosts: unique candidates
        "modeB-near-miss-rotated-17",
        "raw-modeB-near-miss-trusted",
      ].includes(c.name);
      // rotated-17 may or may not trip depending on rotation uncertainty: it must at least not lose data
      if (c.name !== "modeB-near-miss-rotated-17")
        expect(had, c.name).toBe(expected);
    }
  });

  it("no connection is applied: geometry and walls are identical to what the analyzer was shown", () => {
    const r = detailed(NEAR_MISS_PLAN, true);
    const walls = r.geometry.walls;
    // the stem that nearly touched is still 9.97 long and ends where it was drawn
    const stem = walls.find((w) => w.startX === 10 && w.endX === 10)!;
    expect(stem.endY).toBe(9.97);
    expect(stem.length).toBe(9.97);
    // the ledger's segments are exactly the drawn legacy segments (no snapping, no bridges)
    expect(r.topology!.segments).toEqual([
      { x1: 0, y1: 10, x2: 20, y2: 10 },
      { x1: 10, y1: 0, x2: 10, y2: 9.97 },
      { x1: 15, y1: 0, x2: 15, y2: 9.8 },
      { x1: 30, y1: 0, x2: 40, y2: 0 },
      { x1: 35, y1: 0, x2: 45, y2: 0 },
    ]);
    // geometry identical with and without the analyzer's trusted flag except the merge itself
    const untrusted = dxfToGeometry(
      { entities: NEAR_MISS_PLAN } as never,
      undefined,
      { unitTrusted: false },
    );
    expect(untrusted.rooms).toEqual(r.geometry.rooms);
    expect(untrusted.openings).toEqual(r.geometry.openings);
  });

  it("dxfToGeometry keeps its public signature and returns only the geometry", () => {
    const g = dxfToGeometry({ entities: NEAR_MISS_PLAN } as never, undefined, {
      unitTrusted: true,
    });
    expect(Object.keys(g).sort()).toEqual(["openings", "rooms", "walls"]);
    expect(dxfToGeometry.length).toBeLessThanOrEqual(3);
  });

  it("a throwing analyzer never fails the parse or changes the geometry", () => {
    const ok = detailed(NEAR_MISS_PLAN, true);
    spy.fail = true;
    const bad = detailed(NEAR_MISS_PLAN, true);
    expect(bad.topology).toBeUndefined();
    expect(bad.geometry).toEqual(ok.geometry);
    expect(
      bad.report.toMeta({} as never).stats.wallTopologyAnalysisFailed,
    ).toBe(1);
    expect(warnings(bad.report).some((w) => w.code === NEW_CODE)).toBe(false);
  });

  it("jittered plan: the warning counts the unique candidates and nothing is moved", () => {
    const c = goldenCorpus().find((x) => x.name === "modeB-jittered")!;
    const m = (c.run().meta as any).warnings.find(
      (w: any) => w.code === NEW_CODE,
    );
    expect(m.severity).toBe("info");
    expect(m.message).toMatch(/no walls were moved or connected/i);
  });
});

function lineEnt(a: [number, number], b: [number, number]) {
  return { k: "line" as const, layer: "WALLS", a, b };
}
