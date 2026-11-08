// Parser report types. Phase 0: shape only, nothing populates warnings yet.

export type ParseSeverity = "info" | "warning" | "error";

export interface ParseWarning {
  /** Stable machine code, e.g. "UNIT_AMBIGUOUS". */
  code: string;
  severity: ParseSeverity;
  /** User-readable. */
  message: string;
  entity?: { kind: "wall" | "room" | "opening"; id: string };
}

/** "legacy" = the pre-Phase-1 heuristic; it is not verified. */
export type UnitSource =
  | "header"
  | "plausibility"
  | "label-area"
  | "user"
  | "legacy";

export type UnitConfidence = "high" | "medium" | "low" | "unknown";

export interface ParseUnitInfo {
  feetPerUnit: number;
  source: UnitSource;
  confidence: UnitConfidence;
  /** True once a user has confirmed the unit. */
  confirmed: boolean;
}

export interface ParseMeta {
  parserVersion: string;
  unit: ParseUnitInfo;
  /** Reserved for Phase 2 (plan rotated upright by this angle). */
  rotationRad?: number;
  warnings: ParseWarning[];
  /** Counters (entity and result counts, later per-stage drops). */
  stats: Record<string, number>;
}
