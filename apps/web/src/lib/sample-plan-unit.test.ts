// Reads the REAL bundled sample (no parser mock) and proves the unit check
// passes on it, and that it fails closed for a changed fixture.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, vi } from "vitest";

// Only the pure unit check is exercised; no database is touched.
vi.mock("@vectroq/db", () => ({ prisma: {}, Prisma: {} }));
import { parseDxf } from "@vectroq/cad-parser";
import { verifySamplePlanUnit, SAMPLE_PLAN_UNIT } from "./sample-project";
import { buildUnitState, evaluateUnitGate } from "./cad-unit";

const FILE = path.join(process.cwd(), "public/samples/sample-house-plan.dxf");
// Git on Windows may check the file out with CRLF; the edits below assume LF.
const text = readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");
const construction = undefined as never; // parser default rules

describe("bundled sample-house-plan.dxf", () => {
  it("the parser itself reads it as millimetres, at a plausible size", () => {
    const { meta } = parseDxf(text, {});
    expect(meta.unit.unit).toBe("millimetre");
    expect(meta.warnings.map((w) => w.code)).not.toContain("UNIT_HEADER_IMPLAUSIBLE");
    expect(verifySamplePlanUnit(text, construction)).toEqual({ ok: true });
  });

  it("confirming millimetres yields a plausible house footprint and a state the gate trusts", () => {
    const { geometry, meta } = parseDxf(text, { confirmedUnit: SAMPLE_PLAN_UNIT });
    expect(meta.warnings.map((w) => w.code)).not.toContain("UNIT_CONFIRMED_IMPLAUSIBLE");
    const xs = geometry.walls.flatMap((w) => [w.startX, w.endX]);
    const width = Math.max(...xs) - Math.min(...xs);
    expect(width).toBeGreaterThan(35); // ~12 m = 39 ft
    expect(width).toBeLessThan(45);
    expect(evaluateUnitGate(buildUnitState(meta)).ok).toBe(true);
  });

  it("a fixture scaled to metres is refused (no confirmed wrong-scale BOQ)", () => {
    const asMetres = text.replace(/^(\s*(?:10|11|20|21))\r?\n\s*(-?\d+(?:\.\d+)?)$/gm, (_m, code, v) => `${code}\n${Number(v) / 1000}`);
    expect(asMetres).not.toBe(text);
    const r = verifySamplePlanUnit(asMetres, construction);
    expect(r.ok).toBe(false);
  });

  it("a fixture with an explicit non-millimetre header is refused", () => {
    const withHeader = text.replace("9\n$ACADVER", "9\n$INSUNITS\n70\n6\n9\n$ACADVER");
    expect(withHeader).not.toBe(text);
    expect(verifySamplePlanUnit(withHeader, construction).ok).toBe(false);
  });
});
