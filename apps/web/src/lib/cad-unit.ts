// Server-owned drawing-unit state for a CadFile (docs/dxf-units.md).
// Pure and client-safe: no Node, Prisma or blob imports.
import {
  unitNeedsConfirmation,
  type ParseMeta,
  type ParseUnitInfo,
  type ParseWarning,
  type UnitName,
} from "@vectroq/shared-types";

/** What is persisted in CadFile.unit. Written only by the server from a parse. */
export interface CadUnitState {
  unit: ParseUnitInfo;
  warnings: ParseWarning[];
  /** ISO time of the last manual geometry edit since this unit state was set. */
  geometryEditedAt?: string;
}

/** Builds the state to persist from a parse result. */
export function buildUnitState(meta: ParseMeta): CadUnitState {
  return { unit: meta.unit, warnings: meta.warnings };
}

/**
 * Reads CadFile.unit. Returns null for null (legacy row) and for anything that
 * is not a well-formed state, so a damaged value is treated as unverified.
 */
export function readUnitState(raw: unknown): CadUnitState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<CadUnitState>;
  const u = r.unit as Partial<ParseUnitInfo> | undefined;
  if (
    !u ||
    typeof u !== "object" ||
    typeof u.feetPerUnit !== "number" ||
    !(u.feetPerUnit > 0) ||
    typeof u.source !== "string" ||
    typeof u.confirmed !== "boolean"
  )
    return null;
  return {
    unit: u as ParseUnitInfo,
    warnings: Array.isArray(r.warnings) ? (r.warnings as ParseWarning[]) : [],
    ...(typeof r.geometryEditedAt === "string"
      ? { geometryEditedAt: r.geometryEditedAt }
      : {}),
  };
}

/** Unit names a trusted state may carry. "unknown" is deliberately absent. */
const TRUSTED_UNIT_NAMES: readonly string[] = [
  "inch",
  "foot",
  "millimetre",
  "centimetre",
  "metre",
  "yard",
  "decimetre",
  "survey-foot",
] satisfies Exclude<UnitName, "unknown">[];

/**
 * Fail-closed trust check. A state is trusted ONLY if it explicitly says so:
 *  - confirmed by a person: source "user", confirmed true, needsConfirmation false; or
 *  - a valid explicit $INSUNITS header whose size was plausible: source "header",
 *    confirmed false, needsConfirmation false.
 * Everything else (a missing or non-boolean flag, Phase 0 "legacy" shapes,
 * "plausibility"/"none"/"label-area" sources, "unknown" or invented unit names,
 * a non-positive factor) is untrusted and blocks pricing.
 */
export function isTrustedUnit(u: ParseUnitInfo): boolean {
  if (typeof u.unit !== "string" || !TRUSTED_UNIT_NAMES.includes(u.unit))
    return false;
  if (typeof u.feetPerUnit !== "number" || !Number.isFinite(u.feetPerUnit) || !(u.feetPerUnit > 0))
    return false;
  if (u.needsConfirmation !== false) return false;
  if (u.source === "user") return u.confirmed === true;
  if (u.source === "header") return u.confirmed === false;
  return false;
}

export type UnitGate =
  | { ok: true; state: CadUnitState }
  | {
      ok: false;
      /**
       * "legacy-unverified": no unit state stored (row predates unit tracking).
       * "needs-confirmation": the parser said the unit must be confirmed.
       * "untrusted-state": a state is stored but is malformed or not explicitly trusted.
       */
      reason: "legacy-unverified" | "needs-confirmation" | "untrusted-state";
      message: string;
      state: CadUnitState | null;
    };

/**
 * The one rule deciding whether a BOQ may be priced from this drawing.
 * No state (legacy row), an unconfirmed state, or any state that is not
 * explicitly trusted all block.
 */
export function evaluateUnitGate(raw: unknown): UnitGate {
  if (raw === null || raw === undefined) {
    return {
      ok: false,
      reason: "legacy-unverified",
      state: null,
      message:
        "This drawing's units were never verified. Re-upload the DXF and confirm its unit before calculating a BOQ. Re-uploading replaces the current drawing, including any manual corrections. Any BOQ already saved is kept.",
    };
  }
  const state = readUnitState(raw);
  if (!state) {
    return {
      ok: false,
      reason: "untrusted-state",
      state: null,
      message:
        "This drawing's unit record is damaged and cannot be trusted. Re-upload the DXF and confirm its unit. Re-uploading replaces the current drawing, including any manual corrections.",
    };
  }
  if (unitNeedsConfirmation({ unit: state.unit })) {
    return {
      ok: false,
      reason: "needs-confirmation",
      state,
      message:
        "The drawing's unit is not confirmed. Choose the correct unit before calculating a BOQ.",
    };
  }
  if (!isTrustedUnit(state.unit)) {
    return {
      ok: false,
      reason: "untrusted-state",
      state,
      message:
        "This drawing's unit record is incomplete or not trusted. Choose the unit again to continue.",
    };
  }
  return { ok: true, state };
}

/** Returns the state with the edit timestamp set; manual edits never confirm a unit. */
export function withGeometryEdited(
  state: CadUnitState,
  at: Date = new Date(),
): CadUnitState {
  return { ...state, geometryEditedAt: at.toISOString() };
}

/** The part of the state that is safe and useful to send to the browser. */
export function publicUnitState(state: CadUnitState | null) {
  return state
    ? {
        unit: state.unit,
        warnings: state.warnings,
        needsConfirmation: !isTrustedUnit(state.unit),
        geometryEdited: state.geometryEditedAt !== undefined,
      }
    : null;
}
export type PublicUnitState = NonNullable<ReturnType<typeof publicUnitState>>;
