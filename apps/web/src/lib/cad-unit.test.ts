import { describe, it, expect } from "vitest";
import type { ParseMeta } from "@vectroq/shared-types";
import {
  buildUnitState,
  evaluateUnitGate,
  publicUnitState,
  readUnitState,
  withGeometryEdited,
} from "./cad-unit";

const unit = (o: object = {}) => ({
  feetPerUnit: 1,
  source: "header" as const,
  confidence: "high" as const,
  confirmed: false,
  needsConfirmation: false,
  ...o,
});
const meta = (u: object = {}): ParseMeta => ({
  parserVersion: "x",
  unit: unit(u),
  warnings: [{ code: "W", severity: "warning", message: "m" }],
  stats: {},
});

describe("readUnitState", () => {
  it.each([null, undefined, 5, "x", [], {}, { unit: {} }, { unit: { feetPerUnit: 0, source: "header", confirmed: false } },
    { unit: { feetPerUnit: 1, source: "header" } }])("%j is not a state", (v) => {
    expect(readUnitState(v)).toBeNull();
  });
  it("round-trips a built state", () => {
    const s = buildUnitState(meta());
    expect(readUnitState(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
});

describe("evaluateUnitGate", () => {
  it("blocks a legacy row (null unit) as unverified", () => {
    const g = evaluateUnitGate(null);
    expect(g).toMatchObject({ ok: false, reason: "legacy-unverified", state: null });
  });
  it("blocks a damaged value the same way", () => {
    expect(evaluateUnitGate({ nonsense: true })).toMatchObject({ ok: false, reason: "legacy-unverified" });
  });
  it("blocks an unconfirmed suggestion", () => {
    const g = evaluateUnitGate(buildUnitState(meta({ source: "plausibility", needsConfirmation: true })));
    expect(g).toMatchObject({ ok: false, reason: "needs-confirmation" });
  });
  it("allows an explicit header and a user confirmation", () => {
    expect(evaluateUnitGate(buildUnitState(meta())).ok).toBe(true);
    expect(evaluateUnitGate(buildUnitState(meta({ source: "user", confirmed: true, needsConfirmation: false }))).ok).toBe(true);
  });
  it("a confirmed flag wins over a stale needsConfirmation", () => {
    expect(evaluateUnitGate(buildUnitState(meta({ confirmed: true, needsConfirmation: true }))).ok).toBe(true);
  });
});

describe("withGeometryEdited / publicUnitState", () => {
  it("records the edit but never confirms", () => {
    const s = buildUnitState(meta({ source: "plausibility", needsConfirmation: true }));
    const e = withGeometryEdited(s, new Date("2026-01-01T00:00:00Z"));
    expect(e.geometryEditedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(e.unit).toEqual(s.unit);
    expect(evaluateUnitGate(e).ok).toBe(false);
    expect(publicUnitState(e)).toMatchObject({ needsConfirmation: true, geometryEdited: true });
    expect(publicUnitState(null)).toBeNull();
  });
});
