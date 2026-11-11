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
  unit: "foot" as const,
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
  it("blocks a damaged value (distinct reason: untrusted, not legacy)", () => {
    expect(evaluateUnitGate({ nonsense: true })).toMatchObject({ ok: false, reason: "untrusted-state", state: null });
  });
  it("blocks an unconfirmed suggestion", () => {
    const g = evaluateUnitGate(buildUnitState(meta({ source: "plausibility", needsConfirmation: true })));
    expect(g).toMatchObject({ ok: false, reason: "needs-confirmation" });
  });
  it("allows an explicit header and a user confirmation", () => {
    expect(evaluateUnitGate(buildUnitState(meta())).ok).toBe(true);
    expect(evaluateUnitGate(buildUnitState(meta({ source: "user", confirmed: true, needsConfirmation: false }))).ok).toBe(true);
  });
  it("an inconsistent state (confirmed AND needsConfirmation) is NOT trusted", () => {
    // unitNeedsConfirmation() lets confirmed win, but no producer emits this
    // combination, so the gate fails closed rather than guessing which flag is right.
    const g = evaluateUnitGate(buildUnitState(meta({ source: "user", confirmed: true, needsConfirmation: true })));
    expect(g.ok).toBe(false);
  });
});

describe("evaluateUnitGate fails closed on malformed or untrusted states", () => {
  const good = () => JSON.parse(JSON.stringify(buildUnitState(meta())));
  const mutate = (fn: (u: Record<string, unknown>) => void) => {
    const s = good();
    fn(s.unit);
    return s;
  };
  const blocked = (raw: unknown) => {
    const g = evaluateUnitGate(raw);
    expect(g.ok).toBe(false);
    return g;
  };

  it("sanity: the unmodified state passes", () => {
    expect(evaluateUnitGate(good()).ok).toBe(true);
  });
  it("Phase 0 legacy-shaped state (source legacy, no flag, no unit name)", () => {
    blocked({ unit: { feetPerUnit: 0.00328084, source: "legacy", confidence: "unknown", confirmed: false }, warnings: [] });
  });
  it("source none", () => {
    blocked(mutate((u) => { u.source = "none"; u.needsConfirmation = false; u.confirmed = false; }));
  });
  it("source none with unit unknown and no flag (the probe case)", () => {
    blocked(mutate((u) => { u.source = "none"; u.unit = "unknown"; delete u.needsConfirmation; }));
  });
  it("unit unknown even with a trusted-looking source", () => {
    blocked(mutate((u) => { u.unit = "unknown"; }));
    blocked(mutate((u) => { u.unit = "unknown"; u.source = "user"; u.confirmed = true; }));
  });
  it("missing needsConfirmation", () => {
    blocked(mutate((u) => { delete u.needsConfirmation; }));
  });
  it.each(["true", "false", 0, 1, null])("non-boolean needsConfirmation %j", (v) => {
    blocked(mutate((u) => { u.needsConfirmation = v; }));
  });
  it.each(["furlong", "Foot", "", 3, null])("invalid unit name %j", (v) => {
    blocked(mutate((u) => { u.unit = v; }));
  });
  it.each([undefined, "guess", "legacy", "plausibility", "label-area", 7])("missing or untrusted source %j", (v) => {
    blocked(mutate((u) => { if (v === undefined) delete u.source; else u.source = v; }));
  });
  it("source user that is not confirmed, and source header that claims confirmed", () => {
    blocked(mutate((u) => { u.source = "user"; u.confirmed = false; }));
    blocked(mutate((u) => { u.source = "header"; u.confirmed = true; }));
  });
  it.each([0, -1, NaN, Infinity, "1"])("bad feetPerUnit %j", (v) => {
    blocked(mutate((u) => { u.feetPerUnit = v; }));
  });
  it("untrusted-but-structured states report the needs-confirmation public flag", () => {
    const s = readUnitState(mutate((u) => { delete u.needsConfirmation; }));
    expect(publicUnitState(s)).toMatchObject({ needsConfirmation: true });
  });
  it("every legitimate producer state passes (header, user, user on an implausible size)", () => {
    for (const o of [
      {},
      { source: "user", confirmed: true, needsConfirmation: false },
      { source: "user", confirmed: true, needsConfirmation: false, confidence: "low" },
      { unit: "metre", feetPerUnit: 3.280839895 },
    ])
      expect(evaluateUnitGate(buildUnitState(meta(o))).ok).toBe(true);
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
