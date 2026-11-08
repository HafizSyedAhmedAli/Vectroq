// Server-owned drawing-unit state for a CadFile (docs/dxf-units.md).
// Pure and client-safe: no Node, Prisma or blob imports.
import {
  unitNeedsConfirmation,
  type ParseMeta,
  type ParseUnitInfo,
  type ParseWarning,
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

export type UnitGate =
  | { ok: true; state: CadUnitState }
  | {
      ok: false;
      /** "legacy-unverified": no unit state stored (row predates unit tracking). */
      reason: "legacy-unverified" | "needs-confirmation";
      message: string;
      state: CadUnitState | null;
    };

/**
 * The one rule deciding whether a BOQ may be priced from this drawing.
 * No state (legacy row) or an unconfirmed state both block.
 */
export function evaluateUnitGate(raw: unknown): UnitGate {
  const state = readUnitState(raw);
  if (!state) {
    return {
      ok: false,
      reason: "legacy-unverified",
      state: null,
      message:
        "This drawing's units were never verified. Re-upload the DXF and confirm its unit before calculating a BOQ. Any BOQ already saved is kept.",
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
        needsConfirmation: unitNeedsConfirmation({ unit: state.unit }),
        geometryEdited: state.geometryEditedAt !== undefined,
      }
    : null;
}
export type PublicUnitState = NonNullable<ReturnType<typeof publicUnitState>>;
