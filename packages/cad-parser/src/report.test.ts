import { describe, it, expect } from "vitest";
import { ParseReport, PARSER_VERSION, hasErrors } from "./report";

const unit = {
  feetPerUnit: 1,
  source: "legacy",
  confidence: "unknown",
  confirmed: false,
} as const;

describe("ParseReport", () => {
  it("starts empty", () => {
    const m = new ParseReport().toMeta(unit);
    expect(m).toEqual({
      parserVersion: PARSER_VERSION,
      unit,
      warnings: [],
      stats: {},
    });
  });

  it("records warnings by severity and counters", () => {
    const r = new ParseReport();
    r.info("A", "a");
    r.warning("B", "b", { kind: "room", id: "room-0" });
    expect(r.hasErrors()).toBe(false);
    r.error("C", "c");
    r.stat("rooms", 3);
    const m = r.toMeta(unit);
    expect(m.warnings.map((w) => w.severity)).toEqual([
      "info",
      "warning",
      "error",
    ]);
    expect(m.warnings[1].entity).toEqual({ kind: "room", id: "room-0" });
    expect(m.stats).toEqual({ rooms: 3 });
    expect(r.hasErrors()).toBe(true);
    expect(hasErrors(m)).toBe(true);
  });

  it("returns copies, not live references", () => {
    const r = new ParseReport();
    r.info("A", "a");
    const m = r.toMeta(unit);
    m.warnings.push({ code: "X", severity: "error", message: "x" });
    expect(r.toMeta(unit).warnings).toHaveLength(1);
  });

  it("includes rotationRad only when given", () => {
    expect("rotationRad" in new ParseReport().toMeta(unit)).toBe(false);
    expect(
      new ParseReport().toMeta(unit, { rotationRad: 0.5 }).rotationRad,
    ).toBe(0.5);
  });

  it("passes Phase 1 unit fields through unchanged, as copies", () => {
    const rich = {
      feetPerUnit: 0.0328084,
      source: "plausibility",
      confidence: "low",
      confirmed: false,
      unit: "centimetre",
      insunits: 5,
      needsConfirmation: true,
      suggestedUnit: "centimetre",
    } as const;
    const m = new ParseReport().toMeta(rich);
    expect(m.unit).toEqual(rich);
    expect(m.unit).not.toBe(rich);
  });
});
