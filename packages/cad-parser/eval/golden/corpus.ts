// Stage 3c-0 golden corpus: the inputs whose outputs were captured from the
// UNMODIFIED Stage 3b code (see golden-baseline.json -> baselineCommit).
// Keep it small: existing fixture files are referenced, not copied; synthetic
// plans are generated from a few lines each.
import { readFileSync } from "node:fs";
import { dxfToGeometry } from "../../src/dxf-to-geometry";
import { parseDxf } from "../../src/parse-dxf";
import { ParseReport } from "../../src/report";
import { FIXTURES } from "../fixtures";

type P = [number, number];
type Ent =
  | { k: "poly"; layer: string; pts: P[] }
  | { k: "line"; layer: string; a: P; b: P }
  | { k: "arc"; layer: string; c: P; r: number; a0: number; a1: number }
  | { k: "text"; layer: string; p: P; text: string };

const D = Math.PI / 180;
const rp = ([x, y]: P, a: number): P => [
  x * Math.cos(a) - y * Math.sin(a),
  x * Math.sin(a) + y * Math.cos(a),
];

/** DXF text; `insunits` undefined = no $INSUNITS header at all. */
export function dxfText(ents: Ent[], alpha = 0, insunits?: number): string {
  const o: (string | number)[] = ["0", "SECTION", "2", "HEADER"];
  if (insunits !== undefined) o.push("9", "$INSUNITS", "70", insunits);
  o.push("0", "ENDSEC", "0", "SECTION", "2", "ENTITIES");
  const pt = (p: P, i = 0) => {
    const [x, y] = rp(p, alpha);
    o.push(10 + i, x, 20 + i, y, 30 + i, 0);
  };
  for (const e of ents) {
    if (e.k === "poly") {
      o.push("0", "LWPOLYLINE", "8", e.layer, "90", e.pts.length, "70", 1);
      for (const p of e.pts) {
        const [x, y] = rp(p, alpha);
        o.push("10", x, "20", y);
      }
    } else if (e.k === "line") {
      o.push("0", "LINE", "8", e.layer);
      pt(e.a, 0);
      pt(e.b, 1);
    } else if (e.k === "arc") {
      o.push("0", "ARC", "8", e.layer);
      pt(e.c, 0);
      o.push("40", e.r, "50", e.a0 + alpha / D, "51", e.a1 + alpha / D);
    } else {
      o.push("0", "TEXT", "8", e.layer);
      pt(e.p, 0);
      o.push("40", 0.5, "1", e.text, "50", alpha / D);
    }
  }
  o.push("0", "ENDSEC", "0", "EOF");
  return o.join("\n");
}

const wl = (a: P, b: P): Ent => ({ k: "line", layer: "WALLS", a, b });
const door = (a: P, b: P): Ent => ({ k: "line", layer: "DOORS", a, b });
const win = (a: P, b: P): Ent => ({ k: "line", layer: "WINDOWS", a, b });
const swing = (c: P, r: number, a0: number, a1: number): Ent => ({
  k: "arc",
  layer: "DOORS",
  c,
  r,
  a0,
  a1,
});
const text = (p: P, t: string): Ent => ({
  k: "text",
  layer: "ROOMS",
  p,
  text: t,
});
const rect = (x0: number, y0: number, x1: number, y1: number): Ent[] => {
  const r: P[] = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
  return r.map((p, i) => wl(p, r[(i + 1) % 4]));
};

/** Deterministic PRNG (mulberry32) so jitter is reproducible. */
function prng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- synthetic plans (feet; INSUNITS 2 makes the unit trusted) -------------
const HOUSE: Ent[] = [
  ...rect(0, 0, 24, 16),
  wl([12, 0], [12, 16]),
  wl([12, 8], [24, 8]),
  door([4, 0], [7, 0]),
  swing([4, 0], 3, 0, 90),
  win([16, 16], [20, 16]),
  door([12, 3], [12, 6]),
  text([6, 8], "Living 192 sq ft"),
  text([18, 4], "Kitchen"),
  text([18, 12], "Bath"),
];
const OPEN_PLAN: Ent[] = [
  wl([0, 0], [20, 0]),
  wl([20, 0], [20, 14]),
  wl([20, 14], [0, 14]),
  wl([0, 14], [0, 6]), // open side: gap of 6 ft, not a near miss
  wl([8, 0], [8, 7]),
  win([3, 0], [6, 0]),
];
const NEAR_MISS: Ent[] = [
  wl([0, 0], [10, 0]),
  wl([10.03, 0], [20, 0]), // collinear gap 0.03
  wl([20, 0], [20, 12]),
  wl([20, 12], [0, 12]),
  wl([0, 12], [0, 0.04]), // corner short by 0.04
  wl([5, 0.04], [5, 12]), // T stem short by 0.04
  wl([14, 12], [14, 6.2]), // stem short by 0.2 (report band)
  wl([8, 12], [8, 8]), // free end
  door([2, 0], [4, 0]),
];
const OVERLAP: Ent[] = [
  wl([0, 0], [10, 0]),
  wl([6, 0], [16, 0]),
  wl([16, 0], [16, 8]),
  wl([0, 0], [0, 8]),
  wl([0, 8], [16, 8]),
  wl([0, 8], [16, 8]), // exact duplicate
  wl([16, 8], [0, 8]), // reversed duplicate
  wl([16, 0.004], [16, 4]), // near duplicate of a vertical
  door([2, 0], [5, 0]),
  win([12, 0], [14, 0]),
];
const scaled = (ents: Ent[], k: number): Ent[] =>
  ents.map((e) => {
    const m = (p: P): P => [p[0] * k, p[1] * k];
    if (e.k === "line") return { ...e, a: m(e.a), b: m(e.b) };
    if (e.k === "arc") return { ...e, c: m(e.c), r: e.r * k };
    if (e.k === "text") return { ...e, p: m(e.p) };
    return { ...e, pts: e.pts.map(m) };
  });
const jitter = (ents: Ent[], amp: number, seed: number): Ent[] => {
  const r = prng(seed);
  const j = (p: P): P => [p[0] + (r() - 0.5) * amp, p[1] + (r() - 0.5) * amp];
  return ents.map((e) => (e.k === "line" ? { ...e, a: j(e.a), b: j(e.b) } : e));
};
const MODE_A: Ent[] = [
  {
    k: "poly",
    layer: "WALLS",
    pts: [
      [0, 0],
      [15, 0],
      [15, 12],
      [0, 12],
    ],
  },
  {
    k: "poly",
    layer: "WALLS",
    pts: [
      [15, 0],
      [30, 0],
      [30, 12],
      [15, 12],
    ],
  },
  door([5, 0], [8, 0]),
  win([20, 12], [24, 12]),
  text([5, 6], "Bedroom"),
  text([20, 6], "Bath"),
];

export interface GoldenCase {
  name: string;
  /** Runs the parser (the code under test) and returns geometry + meta. */
  run: () => { geometry: unknown; meta: unknown };
  /** "B" when walls are LINEs, "A" for closed polylines, "-" otherwise. */
  mode: "A" | "B" | "-";
  trusted: boolean;
}

const fromText = (
  name: string,
  mode: GoldenCase["mode"],
  trusted: boolean,
  text: string,
): GoldenCase => ({
  name,
  mode,
  trusted,
  run: () => parseDxf(text),
});

const fromRaw = (
  name: string,
  trusted: boolean | undefined,
  ents: Ent[],
): GoldenCase => ({
  name,
  mode: "B",
  trusted: trusted === true,
  run: () => {
    const report = new ParseReport();
    const entities = ents.map((e) =>
      e.k === "line"
        ? {
            type: "LINE",
            layer: e.layer,
            vertices: [
              { x: e.a[0], y: e.a[1] },
              { x: e.b[0], y: e.b[1] },
            ],
          }
        : e.k === "arc"
          ? {
              type: "ARC",
              layer: e.layer,
              center: { x: e.c[0], y: e.c[1] },
              radius: e.r,
              startAngle: (e.a0 * Math.PI) / 180,
              endAngle: (e.a1 * Math.PI) / 180,
            }
          : e.k === "text"
            ? {
                type: "TEXT",
                layer: e.layer,
                startPoint: { x: e.p[0], y: e.p[1] },
                text: e.text,
              }
            : {
                type: "LWPOLYLINE",
                layer: e.layer,
                vertices: e.pts.map(([x, y]) => ({ x, y })),
              },
    );
    const geometry = dxfToGeometry(
      { entities } as never,
      undefined,
      trusted === undefined ? undefined : { report, unitTrusted: trusted },
    );
    return { geometry, meta: report.toMeta({} as never) };
  },
});

export function goldenCorpus(): GoldenCase[] {
  const cases: GoldenCase[] = FIXTURES.map((f) => ({
    name: `fixture:${f.name}`,
    mode: "-" as const,
    trusted: false,
    run: () => parseDxf(readFileSync(f.path, "utf8")),
  }));
  cases.push(
    fromText("modeB-house-closed-openings", "B", true, dxfText(HOUSE, 0, 2)),
    fromText("modeB-open-plan", "B", true, dxfText(OPEN_PLAN, 0, 2)),
    fromText("modeB-near-miss", "B", true, dxfText(NEAR_MISS, 0, 2)),
    fromText(
      "modeB-overlap-dups",
      "B",
      true,
      dxfText(scaled(OVERLAP, 2), 0, 2),
    ),
    fromText(
      "modeB-jittered",
      "B",
      true,
      dxfText(jitter(HOUSE, 0.004, 7), 0, 2),
    ),
    fromText("modeB-rotated-30", "B", true, dxfText(HOUSE, 30 * D, 2)),
    fromText("modeB-rotated-90", "B", true, dxfText(HOUSE, 90 * D, 2)),
    fromText(
      "modeB-near-miss-rotated-17",
      "B",
      true,
      dxfText(NEAR_MISS, 17 * D, 2),
    ),
    fromText("modeB-house-untrusted-nounit", "B", false, dxfText(HOUSE)),
    fromText("modeB-near-miss-untrusted", "B", false, dxfText(NEAR_MISS)),
    fromText("modeB-overlap-untrusted", "B", false, dxfText(OVERLAP)),
    fromText("modeA-two-rooms", "A", true, dxfText(MODE_A, 0, 2)),
    fromText("modeA-two-rooms-rotated", "A", true, dxfText(MODE_A, 25 * D, 2)),
    fromText("modeA-two-rooms-untrusted", "A", false, dxfText(MODE_A)),
    fromRaw("raw-modeB-house-trusted", true, HOUSE),
    fromRaw("raw-modeB-house-untrusted", false, HOUSE),
    fromRaw("raw-modeB-house-noctx", undefined, HOUSE),
    fromRaw("raw-modeB-near-miss-trusted", true, NEAR_MISS),
    fromRaw("raw-modeB-overlap-trusted", true, OVERLAP),
    fromRaw("raw-modeA-trusted", true, MODE_A),
  );
  return cases;
}
