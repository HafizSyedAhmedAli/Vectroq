// packages/cad-parser/src/units.ts
// Phase 1: centralised drawing-unit resolution. See docs/dxf-units.md.
import type {
  ParseUnitInfo,
  ParseWarning,
  UnitCandidate,
  UnitConfidence,
  UnitExtents,
  UnitName,
} from "@vectroq/shared-types";

type KnownUnit = Exclude<UnitName, "unknown">;

interface UnitDef {
  unit: KnownUnit;
  insunits: number;
  /** Exact feet per drawing unit (from the international definitions). */
  feetPerUnit: number;
  /** Factor the pre-Phase-1 code used. Kept only for provisional geometry, see below. */
  legacyFeetPerUnit?: number;
}

/**
 * $INSUNITS codes we convert. Meanings are from the Autodesk DXF reference
 * ($INSUNITS: 1 inches, 2 feet, 4 mm, 5 cm, 6 m, 10 yards, 14 decimetres,
 * 21 US survey feet). 0 = unitless. Every other code (miles, km, microns,
 * mils, astronomical units, ...) is deliberately unsupported: such a drawing is
 * not a building plan we can price, so it is reported as invalid metadata.
 */
export const UNIT_DEFS: readonly UnitDef[] = [
  { unit: "inch", insunits: 1, feetPerUnit: 1 / 12, legacyFeetPerUnit: 1 / 12 },
  { unit: "foot", insunits: 2, feetPerUnit: 1, legacyFeetPerUnit: 1 },
  {
    unit: "millimetre",
    insunits: 4,
    feetPerUnit: 1 / 304.8,
    legacyFeetPerUnit: 0.00328084,
  },
  {
    unit: "centimetre",
    insunits: 5,
    feetPerUnit: 1 / 30.48,
    legacyFeetPerUnit: 0.0328084,
  },
  {
    unit: "metre",
    insunits: 6,
    feetPerUnit: 1 / 0.3048,
    legacyFeetPerUnit: 3.28084,
  },
  { unit: "yard", insunits: 10, feetPerUnit: 3 },
  { unit: "decimetre", insunits: 14, feetPerUnit: 1 / 3.048 },
  { unit: "survey-foot", insunits: 21, feetPerUnit: 1200 / 3937 },
];

const BY_CODE = new Map(UNIT_DEFS.map((d) => [d.insunits, d]));
const BY_NAME = new Map(UNIT_DEFS.map((d) => [d.unit, d]));

/** What a user can pick: a unit name or its $INSUNITS code. */
export type UnitChoice = KnownUnit | number;

/** Units offered as candidates for an unitless drawing (the ones a house plan is drawn in). */
export const CANDIDATE_UNITS: readonly KnownUnit[] = [
  "inch",
  "foot",
  "millimetre",
  "centimetre",
  "metre",
];

/** Documented plausibility rules for a whole-drawing footprint, in feet. They are
 * assumptions about house-scale plans, not facts; see docs/dxf-units.md. */
export const PLAUSIBILITY = {
  minShortSideFt: 8,
  maxLongSideFt: 400,
  minAreaSqFt: 150,
  maxAreaSqFt: 60000,
  /** Used only to ORDER plausible candidates (closest area wins); never to prove one. */
  typicalAreaSqFt: 1500,
} as const;

export function isPlausibleFootprint(widthFt: number, heightFt: number): boolean {
  const long = Math.max(widthFt, heightFt);
  const short = Math.min(widthFt, heightFt);
  const area = widthFt * heightFt;
  return (
    short >= PLAUSIBILITY.minShortSideFt &&
    long <= PLAUSIBILITY.maxLongSideFt &&
    area >= PLAUSIBILITY.minAreaSqFt &&
    area <= PLAUSIBILITY.maxAreaSqFt
  );
}

/** Resolves a user choice to a unit definition, or throws. */
export function unitDefFor(choice: UnitChoice): UnitDef {
  const def =
    typeof choice === "number" ? BY_CODE.get(choice) : BY_NAME.get(choice);
  if (!def) {
    throw new Error(
      `Unsupported drawing unit "${String(choice)}". Supported: ${UNIT_DEFS.map((d) => `${d.unit} (${d.insunits})`).join(", ")}.`,
    );
  }
  return def;
}

/** Entity types whose coordinates describe drawn geometry (not text or dimensions). */
const GEOMETRIC = new Set(["LINE", "LWPOLYLINE", "POLYLINE", "CIRCLE", "ARC"]);

function collectCoords(entities: any[]): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  const push = (x: unknown, y: unknown) => {
    if (typeof x === "number" && typeof y === "number" && isFinite(x) && isFinite(y)) {
      xs.push(x);
      ys.push(y);
    }
  };
  for (const e of entities) {
    if (!e || !GEOMETRIC.has(e.type)) continue;
    for (const v of e.vertices ?? []) push(v?.x, v?.y);
    if (e.center && typeof e.radius === "number") {
      push(e.center.x - e.radius, e.center.y - e.radius);
      push(e.center.x + e.radius, e.center.y + e.radius);
    }
  }
  return { xs, ys };
}

const boxOf = (xs: number[], ys: number[]): UnitExtents | undefined => {
  if (!xs.length) return undefined;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let i = 0; i < xs.length; i++) {
    minX = Math.min(minX, xs[i]);
    maxX = Math.max(maxX, xs[i]);
    minY = Math.min(minY, ys[i]);
    maxY = Math.max(maxY, ys[i]);
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    points: xs.length,
  };
};

/**
 * Geometry bounds of the drawing in raw units. Width and height, not distance
 * from the origin: translating a drawing never changes them.
 */
export function drawingExtents(entities: any[]): UnitExtents | undefined {
  const { xs, ys } = collectCoords(entities);
  return boxOf(xs, ys);
}

/** 5th-95th percentile box: ignores a few stray far-away entities (a site boundary, a title block). */
function coreExtents(entities: any[]): UnitExtents | undefined {
  const { xs, ys } = collectCoords(entities);
  if (xs.length < 20) return undefined;
  const trim = (a: number[]) => {
    const s = [...a].sort((p, q) => p - q);
    const lo = s[Math.floor(s.length * 0.05)];
    const hi = s[Math.ceil(s.length * 0.95) - 1];
    return [lo, hi] as const;
  };
  const [x0, x1] = trim(xs);
  const [y0, y1] = trim(ys);
  return {
    minX: x0,
    minY: y0,
    maxX: x1,
    maxY: y1,
    width: x1 - x0,
    height: y1 - y0,
    points: xs.length,
  };
}

const f1 = (n: number) => (n >= 100 ? n.toFixed(0) : n.toFixed(1));

/** Evaluates every candidate unit against the plausibility rules. */
export function evaluateCandidates(
  full: UnitExtents,
  core?: UnitExtents,
): UnitCandidate[] {
  return CANDIDATE_UNITS.map((u) => {
    const def = BY_NAME.get(u)!;
    const k = def.feetPerUnit;
    const wFt = full.width * k;
    const hFt = full.height * k;
    const fullOk = isPlausibleFootprint(wFt, hFt);
    const coreOk =
      !fullOk && core ? isPlausibleFootprint(core.width * k, core.height * k) : false;
    const plausible = fullOk || coreOk;
    const size = `${f1(wFt)} x ${f1(hFt)} ft`;
    const reason = fullOk
      ? `Read as ${u}s the drawing is ${size}, a plausible building footprint.`
      : coreOk
        ? `Read as ${u}s the drawing is ${size}, too large overall, but its main body (ignoring far-off outliers such as a site boundary) is ${f1(core!.width * k)} x ${f1(core!.height * k)} ft, which is plausible.`
        : `Read as ${u}s the drawing is ${size}, not a plausible building footprint.`;
    return {
      unit: u,
      insunits: def.insunits,
      feetPerUnit: k,
      widthFt: wFt,
      heightFt: hFt,
      plausible,
      reason,
    };
  });
}

/** Order plausible candidates: area closest (in log terms) to a typical house first. */
function rank(c: UnitCandidate): number {
  const a = Math.max(c.widthFt * c.heightFt, 1e-9);
  return Math.abs(Math.log(a / PLAUSIBILITY.typicalAreaSqFt));
}

export interface ResolveUnitsInput {
  /** dxf.header, if the library exposed one. */
  header?: unknown;
  /** Raw (unscaled) entities. */
  entities: any[];
  /** A unit the user selected or confirmed. Always wins. */
  confirmed?: UnitChoice;
}

export interface UnitResolution {
  unit: ParseUnitInfo;
  warnings: ParseWarning[];
}

type HeaderState =
  | { kind: "valid"; def: UnitDef }
  | { kind: "unitless" }
  | { kind: "missing" }
  | { kind: "invalid"; raw: unknown };

function readHeader(header: unknown): HeaderState {
  const raw = (header as { $INSUNITS?: unknown } | undefined)?.$INSUNITS;
  if (raw === undefined || raw === null) return { kind: "missing" };
  if (typeof raw === "number" && Number.isInteger(raw)) {
    if (raw === 0) return { kind: "unitless" };
    const def = BY_CODE.get(raw);
    if (def) return { kind: "valid", def };
  }
  return { kind: "invalid", raw };
}

/**
 * The single place that decides a drawing's unit.
 *
 * 1. A user-confirmed unit wins over everything (source "user").
 * 2. Else a valid explicit $INSUNITS is used (source "header").
 * 3. Else (missing, 0, or invalid): extents are evaluated against the
 *    plausibility rules. The result is ALWAYS needsConfirmation: geometric
 *    plausibility is not proof of the original unit. If one candidate is
 *    plausible it is suggested (medium); if several are, the drawing is
 *    ambiguous (low) and the most house-like one is only a provisional pick.
 *    If none is plausible the unit is unknown and coordinates are left as drawn.
 *
 * Provisional factors for mm/cm/m use the pre-Phase-1 constants (3.28084 etc.)
 * so geometry of unconfirmed legacy drawings is bit-identical to Phase 0.
 * Header and user-confirmed units use the exact definitions.
 */
export function resolveUnits(input: ResolveUnitsInput): UnitResolution {
  const warnings: ParseWarning[] = [];
  const w = (
    severity: ParseWarning["severity"],
    code: string,
    message: string,
  ) => warnings.push({ code, severity, message });

  const header = readHeader(input.header);
  const full = drawingExtents(input.entities);
  const core = coreExtents(input.entities);
  const candidates = full ? evaluateCandidates(full, core) : undefined;
  const plausible = (candidates ?? []).filter((c) => c.plausible);
  const confirmedDef =
    input.confirmed !== undefined ? unitDefFor(input.confirmed) : undefined;

  // Describe the header problem (a warning, or info once a user has settled it).
  const headerSeverity = confirmedDef ? "info" : "warning";
  if (header.kind === "missing" || header.kind === "unitless") {
    w(
      headerSeverity,
      "UNIT_METADATA_MISSING",
      header.kind === "unitless"
        ? "The DXF declares no units ($INSUNITS = 0)."
        : "The DXF has no $INSUNITS header, so its units are not declared.",
    );
  } else if (header.kind === "invalid") {
    w(
      headerSeverity,
      "UNIT_METADATA_INVALID",
      `The DXF's $INSUNITS value (${typeof header.raw === "number" ? String(header.raw) : JSON.stringify(header.raw)}) is invalid or a unit this parser does not support, so it was ignored.`,
    );
  }

  // Provisional suggestion from extents (also reported when the user overrides it).
  let suggested: UnitCandidate | undefined;
  if (plausible.length) suggested = [...plausible].sort((a, b) => rank(a) - rank(b))[0];

  const base = {
    ...(full ? { extents: full } : {}),
    ...(candidates ? { candidates } : {}),
  };

  // 1. User confirmation.
  if (confirmedDef) {
    const overridden =
      header.kind === "valid" && header.def.unit !== confirmedDef.unit
        ? ` This overrides the drawing's own $INSUNITS (${header.def.unit}).`
        : suggested && suggested.unit !== confirmedDef.unit
          ? ` This differs from the suggested unit (${suggested.unit}).`
          : "";
    w(
      "info",
      "UNIT_USER_CONFIRMED",
      `Drawing unit confirmed by the user: ${confirmedDef.unit}s.${overridden}`,
    );
    const suggestedUnit: UnitName | undefined =
      header.kind === "valid" ? header.def.unit : suggested?.unit;
    return {
      unit: {
        feetPerUnit: confirmedDef.feetPerUnit,
        source: "user",
        confidence: "high",
        confirmed: true,
        unit: confirmedDef.unit,
        insunits: confirmedDef.insunits,
        needsConfirmation: false,
        ...base,
        ...(suggestedUnit ? { suggestedUnit } : {}),
      },
      warnings,
    };
  }

  // 2. Explicit header.
  if (header.kind === "valid") {
    const k = header.def.feetPerUnit;
    let confidence: UnitConfidence = "high";
    if (full && !isPlausibleFootprint(full.width * k, full.height * k)) {
      const core2 = core && isPlausibleFootprint(core.width * k, core.height * k);
      if (!core2) {
        confidence = "medium";
        w(
          "warning",
          "UNIT_HEADER_IMPLAUSIBLE",
          `$INSUNITS says ${header.def.unit}s, but the drawing then measures ${f1(full.width * k)} x ${f1(full.height * k)} ft, which is not a typical building footprint. The header was used as declared; check the units if the quantities look wrong.`,
        );
      }
    }
    return {
      unit: {
        feetPerUnit: k,
        source: "header",
        confidence,
        confirmed: false,
        unit: header.def.unit,
        insunits: header.def.insunits,
        needsConfirmation: false,
        ...base,
      },
      warnings,
    };
  }

  // 3. Unitless / invalid / missing: suggestion only, confirmation mandatory.
  if (plausible.length > 1) {
    w(
      "warning",
      "UNIT_AMBIGUOUS",
      `More than one unit gives a plausible building size (${plausible.map((c) => `${c.unit}s: ${f1(c.widthFt)} x ${f1(c.heightFt)} ft`).join("; ")}). The unit cannot be determined from the drawing alone.`,
    );
  }
  if (suggested) {
    const def = BY_NAME.get(suggested.unit)!;
    const ambiguous = plausible.length > 1;
    w(
      "warning",
      "UNIT_CONFIRMATION_REQUIRED",
      ambiguous
        ? `Please select the drawing unit. Provisional geometry uses ${suggested.unit}s (the most house-sized reading) and must not be priced until a unit is confirmed.`
        : `Please confirm the drawing unit. Suggested: ${suggested.unit}s, the only unit giving a plausible building size. This is a guess from the drawing's size, not proof; provisional geometry must not be priced until confirmed.`,
    );
    return {
      unit: {
        feetPerUnit: def.legacyFeetPerUnit ?? def.feetPerUnit,
        source: "plausibility",
        confidence: ambiguous ? "low" : "medium",
        confirmed: false,
        unit: suggested.unit,
        insunits: def.insunits,
        needsConfirmation: true,
        ...base,
      },
      warnings,
    };
  }

  w(
    "warning",
    "UNIT_CONFIRMATION_REQUIRED",
    full
      ? "The drawing unit could not be determined: no supported unit gives a plausible building size. Coordinates were left as drawn (factor 1) and the geometry is not usable until a unit is confirmed."
      : "The drawing has no measurable geometry, so its unit could not be determined. Confirm the unit if geometry is added.",
  );
  return {
    unit: {
      feetPerUnit: 1,
      source: "none",
      confidence: "unknown",
      confirmed: false,
      unit: "unknown",
      needsConfirmation: true,
      ...base,
    },
    warnings,
  };
}
