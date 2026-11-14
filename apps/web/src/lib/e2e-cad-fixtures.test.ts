// @vitest-environment node
// Guards the facts the CAD E2E specs rely on (tests/e2e/support/cad.ts). If the
// parser or a fixture changes, this fails fast with a clear message instead of a
// confusing browser failure.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseDxf } from "@vectroq/cad-parser";

const read = (f: string) =>
  readFileSync(resolve(__dirname, "../../../../packages/cad-parser/fixtures", f), "utf8");

describe("E2E CAD fixtures", () => {
  it("sample-house.dxf declares feet in its header and needs no confirmation", () => {
    const { geometry, meta } = parseDxf(read("sample-house.dxf"), {});
    expect(meta.unit).toMatchObject({ unit: "foot", source: "header", confirmed: false, needsConfirmation: false });
    expect([geometry.rooms.length, geometry.walls.length]).toEqual([3, 12]);
  });
  it("whole_house_simple_plan.dxf has no unit header and needs confirmation", () => {
    const { geometry, meta } = parseDxf(read("whole_house_simple_plan.dxf"), {});
    expect(meta.unit).toMatchObject({ unit: "millimetre", source: "plausibility", needsConfirmation: true });
    expect([geometry.rooms.length, geometry.walls.length]).toEqual([7, 12]);
  });
  it("whole_house_simple_plan.dxf read as feet is flagged implausible once confirmed", () => {
    const { meta } = parseDxf(read("whole_house_simple_plan.dxf"), { confirmedUnit: "foot" });
    expect(meta.warnings.map((w) => w.code)).toContain("UNIT_CONFIRMED_IMPLAUSIBLE");
  });
});
