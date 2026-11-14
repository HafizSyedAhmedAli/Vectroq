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

/**
 * Where the unit decision came from.
 * "header" = valid explicit $INSUNITS; "user" = confirmed by a person;
 * "plausibility" = suggested from drawing extents (never proof);
 * "none" = nothing usable (factor is 1, coordinates left as drawn);
 * "legacy" = the pre-Phase-1 heuristic (kept for old data); "label-area" is reserved.
 */
export type UnitSource =
  | "header"
  | "plausibility"
  | "label-area"
  | "user"
  | "legacy"
  | "none";

export type UnitConfidence = "high" | "medium" | "low" | "unknown";

/** Drawing units the parser can convert. "unknown" = not established. */
export type UnitName =
  | "inch"
  | "foot"
  | "millimetre"
  | "centimetre"
  | "metre"
  | "yard"
  | "decimetre"
  | "survey-foot"
  | "unknown";

/** Bounding box of the geometry used for unit detection, in RAW drawing units. */
export interface UnitExtents {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  /** Number of coordinates the box was built from. */
  points: number;
}

/** One interpretation of an unitless drawing, evaluated against plausibility rules. */
export interface UnitCandidate {
  unit: Exclude<UnitName, "unknown">;
  /** DXF $INSUNITS code for this unit. */
  insunits: number;
  feetPerUnit: number;
  /** Drawing extents if read in this unit. */
  widthFt: number;
  heightFt: number;
  /** Passes the documented plausibility rules. Plausible is NOT proven. */
  plausible: boolean;
  reason: string;
}

export interface ParseUnitInfo {
  /** The factor actually applied to the coordinates. */
  feetPerUnit: number;
  source: UnitSource;
  confidence: UnitConfidence;
  /** True once a user has confirmed the unit. */
  confirmed: boolean;
  /** Original drawing unit. Absent on Phase 0 meta. */
  unit?: UnitName;
  /** $INSUNITS code of `unit`. */
  insunits?: number;
  /**
   * True when the unit is not established (unitless/invalid header and nobody
   * confirmed it). Geometry is then provisional and must not feed a trusted BOQ.
   */
  needsConfirmation?: boolean;
  /** Extents the decision looked at (raw units). Absent when there was no geometry. */
  extents?: UnitExtents;
  /** Interpretations considered for an unitless drawing. */
  candidates?: UnitCandidate[];
  /** What the parser suggested before a user confirmation replaced it. */
  suggestedUnit?: UnitName;
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

/**
 * True when the drawing's unit is unresolved: geometry is provisional and a
 * person must choose or confirm the unit before a BOQ can be trusted.
 */
export const unitNeedsConfirmation = (meta: Pick<ParseMeta, "unit">): boolean =>
  meta.unit.needsConfirmation === true && !meta.unit.confirmed;
