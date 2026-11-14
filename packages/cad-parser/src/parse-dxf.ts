// packages/cad-parser/src/parse-dxf.ts
import type {
  ConstructionDefaults,
  Geometry,
  ParseMeta,
} from "@vectroq/shared-types";
import DxfParser from "dxf-parser";
import { dxfToGeometry, type RawEntity } from "./dxf-to-geometry";
import { ParseReport } from "./report";
import { resolveUnits, type UnitChoice } from "./units";

// $INSUNITS code -> feet per drawing unit
const FEET_PER_UNIT: Record<number, number> = {
  1: 1 / 12, // inch
  2: 1, // foot
  4: 0.00328084, // mm
  5: 0.0328084, // cm
  6: 3.28084, // m
};

/**
 * COMPATIBILITY WRAPPER, unchanged on purpose (audit probes U1-U3 pin it).
 * Feet per drawing unit. Header wins; if absent, a drawing more than 500
 * units across is assumed to be millimetres. That guess is unreliable (it takes
 * the largest absolute coordinate, so metre/cm/offset drawings are misread).
 * parseDxf() no longer uses it: it calls resolveUnits() from ./units, which
 * reports ambiguity and needs user confirmation. Do not use this for new code.
 * @deprecated use resolveUnits()
 */
export function feetPerUnit(insunits: unknown, maxExtent: number): number {
  const code = typeof insunits === "number" ? insunits : 0;
  if (FEET_PER_UNIT[code]) return FEET_PER_UNIT[code];
  return maxExtent > 500 ? FEET_PER_UNIT[4] : 1;
}

function scaleEntity(e: any, k: number): RawEntity {
  const pt = (p: any) => (p ? { ...p, x: p.x * k, y: p.y * k } : p);
  return {
    ...e,
    vertices: e.vertices?.map(pt),
    startPoint: pt(e.startPoint),
    center: pt(e.center),
    radius: typeof e.radius === "number" ? e.radius * k : e.radius,
  } as RawEntity;
}

export interface ParseOptions {
  construction?: ConstructionDefaults;
  /**
   * A unit the user selected or confirmed (name or $INSUNITS code). It wins
   * over the header and over any suggestion, and is the unit used to convert.
   */
  confirmedUnit?: UnitChoice;
}

export interface ParseResult {
  geometry: Geometry;
  meta: ParseMeta;
}

/**
 * Parses a DXF into geometry plus a parse report.
 * Units (Phase 1): resolved by resolveUnits(). If meta.unit.needsConfirmation
 * is true (and not confirmed) the geometry is PROVISIONAL, built from a
 * suggested unit, and must not feed a trusted BOQ. Pass opts.confirmedUnit to
 * convert with the user's choice. Everything after unit scaling is unchanged.
 */
export function parseDxf(
  dxfText: string,
  opts: ParseOptions = {},
): ParseResult {
  const report = new ParseReport();
  const parser = new DxfParser();
  const dxf = parser.parseSync(dxfText);
  if (!dxf) {
    throw new Error(
      "dxf-parser returned no result — the file may be malformed or empty.",
    );
  }
  const entities = (dxf.entities ?? []) as any[];
  // MTEXT carries its anchor in `position`; treat it like TEXT.
  const normalised = entities.map((e) =>
    e.type === "MTEXT"
      ? {
          ...e,
          type: "TEXT",
          startPoint: e.position,
          text: String(e.text ?? "").replace(/\\P/g, " "),
        }
      : e,
  );
  const { unit, warnings } = resolveUnits({
    header: (dxf.header as any) ?? undefined,
    entities: normalised,
    confirmed: opts.confirmedUnit,
  });
  for (const w of warnings) report.add(w.severity, w.code, w.message);
  const k = unit.feetPerUnit;
  const geometry = dxfToGeometry(
    { entities: normalised.map((e) => scaleEntity(e, k)) },
    opts.construction,
  );

  report.stat("entities", entities.length);
  report.stat("walls", geometry.walls.length);
  report.stat("rooms", geometry.rooms.length);
  report.stat("openings", geometry.openings.length);

  const meta = report.toMeta(unit);
  return { geometry, meta };
}

/** Backward-compatible entry point. Unchanged signature and output. */
export function parseDxfToGeometry(
  dxfText: string,
  construction?: ConstructionDefaults,
): Geometry {
  return parseDxf(dxfText, { construction }).geometry;
}