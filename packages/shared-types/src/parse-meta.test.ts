import { describe, it, expect } from "vitest";
import { PARSER_BOQ_INVARIANTS, type Geometry, type ParseMeta } from "./index";

describe("parser contract types", () => {
  it("old-shaped geometry (no new fields) is still valid", () => {
    const g = { walls: [], rooms: [], openings: [] } satisfies Geometry;
    expect(g.walls).toEqual([]);
  });

  it("accepts a full meta object", () => {
    const m = {
      parserVersion: "x",
      unit: {
        feetPerUnit: 1,
        source: "legacy",
        confidence: "unknown",
        confirmed: false,
      },
      warnings: [{ code: "C", severity: "info", message: "m" }],
      stats: { rooms: 0 },
    } satisfies ParseMeta;
    expect(m.warnings).toHaveLength(1);
  });

  it("documents INV-1..INV-5 exactly once each", () => {
    expect(PARSER_BOQ_INVARIANTS.map((i) => i.id)).toEqual([
      "INV-1",
      "INV-2",
      "INV-3",
      "INV-4",
      "INV-5",
    ]);
    for (const i of PARSER_BOQ_INVARIANTS)
      expect(i.rule.length).toBeGreaterThan(20);
  });
});
