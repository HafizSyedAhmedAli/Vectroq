import { describe, it, expect } from "vitest";
import { sniffPlanFile } from "./plan-file";

const bytes = (...n: number[]) => new Uint8Array(n);
const text = (s: string) => new TextEncoder().encode(s);

describe("sniffPlanFile", () => {
  it("accepts real signatures", () => {
    expect(sniffPlanFile(text("%PDF-1.7\n..."), "pdf")).toBeNull();
    expect(
      sniffPlanFile(
        bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
        "png",
      ),
    ).toBeNull();
    expect(sniffPlanFile(bytes(0xff, 0xd8, 0xff, 0xe0), "jpg")).toBeNull();
    expect(sniffPlanFile(text("AC1027...."), "dwg")).toBeNull();
    expect(sniffPlanFile(text("  0\nSECTION\n  2\nHEADER"), "dxf")).toBeNull();
  });

  it("rejects an .exe renamed to .pdf, .png, .jpg, .dwg", () => {
    const exe = text("MZ\x90\x00\x03");
    for (const ext of ["pdf", "png", "jpg", "jpeg", "dwg"])
      expect(sniffPlanFile(exe, ext)).toMatch(/don't match/);
  });

  it("rejects a DXF that is binary or not a DXF", () => {
    expect(sniffPlanFile(bytes(0x41, 0x00, 0x42), "dxf")).toMatch(/Binary/);
    expect(sniffPlanFile(text("hello world"), "dxf")).toMatch(/don't match/);
  });
});
