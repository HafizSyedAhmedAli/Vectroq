import type { ParseMeta } from "@vectroq/shared-types";
import { parseDxf } from "../src/parse-dxf";
import { summarizeGeometry, type GeometrySummary } from "./summarize";

/** Independently measured values for a drawing. Never derive these from parser output. */
export interface GroundTruth {
  totalWallFt?: number;
  totalRoomAreaSqFt?: number;
  rooms?: number;
  doors?: number;
  windows?: number;
}

export interface EvalRow {
  name: string;
  summary: GeometrySummary;
  meta: ParseMeta;
  /** Signed relative errors; null when no ground truth. */
  wallLengthErrPct: number | null;
  areaErrPct: number | null;
  // TODO(Phase 8): room/wall/opening precision-recall-F1, duplicate rates,
  // unit correctness, silent-failure rate (plan §7.4).
}

const pct = (got: number, truth?: number) =>
  truth === undefined || truth === 0 ? null : ((got - truth) / truth) * 100;

export function evaluate(
  name: string,
  dxfText: string,
  truth?: GroundTruth,
): EvalRow {
  const { geometry, meta } = parseDxf(dxfText);
  const summary = summarizeGeometry(geometry);
  return {
    name,
    summary,
    meta,
    wallLengthErrPct: pct(summary.totalWallFt, truth?.totalWallFt),
    areaErrPct: pct(summary.totalRoomAreaSqFt, truth?.totalRoomAreaSqFt),
  };
}

export function formatTable(rows: EvalRow[]) {
  return rows.map((r) => ({
    fixture: r.name,
    rooms: r.summary.rooms,
    walls: r.summary.walls,
    doors: r.summary.doors,
    windows: r.summary.windows,
    wallFt: +r.summary.totalWallFt.toFixed(2),
    areaSqFt: +r.summary.totalRoomAreaSqFt.toFixed(2),
    ftPerUnit: r.meta.unit.feetPerUnit,
    warnings: r.meta.warnings.length,
  }));
}
