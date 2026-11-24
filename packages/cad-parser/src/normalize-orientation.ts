// packages/cad-parser/src/normalize-orientation.ts
//
// Phase 2, Stage 3b: the pipeline stage that rotates a plan upright. Runs in
// parseDxf AFTER unit scaling (so every tolerance is in feet) and BEFORE
// dxfToGeometry builds walls, rooms and openings, so Mode A and Mode B both see
// the same normalized entities. Units are not touched; the original DXF is not
// touched (this works on the parsed representation).
import { detectOrientation, wallSegmentsOf } from "./orientation";
import { rotateEntities } from "./rotate-entities";
import type { ParseReport } from "./report";

export interface NormalizedOrientation<T> {
  entities: T[];
  /** The transformation actually applied, radians; counter-clockwise positive; 0 when none. */
  rotationRad: number;
}

export function normalizeOrientation<T extends { type: string }>(
  entities: T[],
  report?: ParseReport,
): NormalizedOrientation<T> {
  const r = detectOrientation(wallSegmentsOf(entities));
  if (r.status === "rotate") {
    const deg = (r.rotationRad * 180) / Math.PI;
    report?.info(
      "PLAN_ROTATED",
      `The plan was rotated by ${deg.toFixed(4)} degrees (counter-clockwise positive) so its walls are axis-aligned.`,
    );
    return {
      entities: rotateEntities(entities as any[], r.rotationRad) as T[],
      rotationRad: r.rotationRad,
    };
  }
  if (r.status === "uncertain") {
    report?.warning(
      "ROTATION_UNCERTAIN",
      `The plan looks rotated (dominant wall direction ${((r.detectedRad * 180) / Math.PI).toFixed(2)} degrees) but its orientation could not be established confidently: ${r.reason}. It was left as drawn.`,
    );
  }
  return { entities, rotationRad: 0 };
}
