// packages/cad-parser/src/parse-dxf.ts
import DxfParser from "dxf-parser";
import type { Geometry } from "@tmcc/shared-types";
import { dxfToGeometry, type RawEntity } from "./dxf-to-geometry";

// $INSUNITS code -> feet per drawing unit
const FEET_PER_UNIT: Record<number, number> = {
  1: 1 / 12, // inch
  2: 1, // foot
  4: 0.00328084, // mm
  5: 0.0328084, // cm
  6: 3.28084, // m
};

/** Feet per drawing unit. Header wins; if absent, a drawing more than 500
 * units across is assumed to be millimetres (nobody draws a 500 ft house). */
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
  } as RawEntity;
}

export function parseDxfToGeometry(dxfText: string): Geometry {
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
  const coords = normalised.flatMap((e) => [
    ...(e.vertices ?? []).flatMap((v: any) => [Math.abs(v.x), Math.abs(v.y)]),
  ]);
  const maxExtent = coords.length ? Math.max(...coords) : 0;
  const k = feetPerUnit((dxf.header as any)?.$INSUNITS, maxExtent);
  return dxfToGeometry({ entities: normalised.map((e) => scaleEntity(e, k)) });
}
