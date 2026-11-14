import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { DEFAULT_CONSTRUCTION } from "../src/dxf-to-geometry";
import { parseDxf, parseDxfToGeometry } from "../src/parse-dxf";
import { PARSER_VERSION } from "../src/report";
import { evaluate, formatTable, type EvalRow } from "./harness";
import { summarizeGeometry } from "./summarize";
import { FIXTURES } from "./fixtures";

describe("fixtures are present", () => {
  it("finds at least the three package fixtures", () => {
    expect(FIXTURES.length).toBeGreaterThanOrEqual(3);
  });
});

describe.each(FIXTURES)("old vs new entry point: $name", ({ path }) => {
  const text = readFileSync(path, "utf8");

  it("parseDxf().geometry is identical to parseDxfToGeometry()", () => {
    const legacy = parseDxfToGeometry(text);
    const { geometry } = parseDxf(text);
    expect(geometry).toEqual(legacy);
    expect(JSON.stringify(geometry)).toBe(JSON.stringify(legacy));
  });

  it("does not attach meta to geometry (stored JSON stays unchanged)", () => {
    expect("meta" in parseDxf(text).geometry).toBe(false);
  });

  it("passes construction defaults through identically", () => {
    const c = { ...DEFAULT_CONSTRUCTION, wallHeightFt: 12 };
    expect(parseDxf(text, { construction: c }).geometry).toEqual(
      parseDxfToGeometry(text, c),
    );
  });

  // Phase 1 supersedes the Phase 0 assertion (legacy unit, no warnings). Geometry
  // equality above is untouched; only the meta contract changed (docs/dxf-units.md).
  it("returns phase-1 meta: explicit header is trusted, unitless is flagged, counts match", () => {
    const { geometry, meta } = parseDxf(text);
    expect(meta.parserVersion).toBe(PARSER_VERSION);
    expect(meta.unit.feetPerUnit).toBeGreaterThan(0);
    if (meta.unit.source === "header") {
      expect(meta.unit).toMatchObject({ confidence: "high", confirmed: false, needsConfirmation: false });
      expect(meta.warnings).toEqual([]);
    } else {
      expect(meta.unit).toMatchObject({ source: "plausibility", confirmed: false, needsConfirmation: true });
      expect(meta.warnings.map((w) => w.code)).toEqual(["UNIT_METADATA_MISSING", "UNIT_CONFIRMATION_REQUIRED"]);
    }
    expect(meta.stats).toMatchObject({
      walls: geometry.walls.length,
      rooms: geometry.rooms.length,
      openings: geometry.openings.length,
    });
  });
});

describe("eval harness", () => {
  it("summarizeGeometry matches hand-computed values", () => {
    const wall = (id: string, length: number) => ({
      id,
      startX: 0,
      startY: 0,
      endX: length,
      endY: 0,
      length,
      height: 10,
      thickness: 0.75,
    });
    const s = summarizeGeometry({
      walls: [wall("a", 10), wall("b", 5)],
      rooms: [
        { id: "r1", name: "Living", area: 100, type: "general" },
        { id: "r2", name: "Bath", area: 40, type: "bathroom" },
      ],
      openings: [
        { id: "d", type: "door", width: 3, height: 7 },
        { id: "w", type: "window", width: 4, height: 4 },
      ],
    });
    expect(s).toEqual({
      walls: 2,
      rooms: 2,
      doors: 1,
      windows: 1,
      bathrooms: 1,
      totalWallFt: 15,
      totalRoomAreaSqFt: 140,
    });
  });

  it("prints a per-fixture table (informational, no numeric assertions)", () => {
    const rows: EvalRow[] = FIXTURES.map((f) =>
      evaluate(f.name, readFileSync(f.path, "utf8")),
    );
    console.table(formatTable(rows));
    expect(rows.every((r) => r.wallLengthErrPct === null)).toBe(true);
  });
});
