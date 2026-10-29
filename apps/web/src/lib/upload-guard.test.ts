// @vitest-environment node
import { describe, it, expect } from "vitest";
import { checkFileContent } from "./upload-guard";

const MISMATCH = "The file's contents don't match its extension.";
const file = (parts: BlobPart[], name: string) => new File(parts, name);

describe("checkFileContent", () => {
  it("accepts a real PDF, PNG and ASCII DXF", async () => {
    expect(await checkFileContent(file(["%PDF-1.7"], "a.pdf"))).toBeNull();
    expect(
      await checkFileContent(
        file(
          [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
          "a.png",
        ),
      ),
    ).toBeNull();
    expect(
      await checkFileContent(file(["  0\nSECTION\n  2\nHEADER"], "a.dxf")),
    ).toBeNull();
  });

  it("rejects an executable renamed to .pdf", async () => {
    expect(await checkFileContent(file(["MZ\x90\x00"], "a.pdf"))).toBe(
      MISMATCH,
    );
  });

  it("an explicit extension overrides the file name", async () => {
    expect(
      await checkFileContent(file(["%PDF"], "renamed.bin"), "pdf"),
    ).toBeNull();
    expect(await checkFileContent(file(["%PDF"], "a.pdf"), "png")).toBe(
      MISMATCH,
    );
  });

  it("rejects binary DXF with a specific message", async () => {
    expect(
      await checkFileContent(file([new Uint8Array([0x41, 0, 0x42])], "a.dxf")),
    ).toBe("Binary DXF files aren't supported. Save as ASCII DXF.");
  });

  it("only looks at the first 4 KB", async () => {
    expect(
      await checkFileContent(file(["x".repeat(5000) + "SECTION"], "a.dxf")),
    ).toBe(MISMATCH);
  });

  it("lets unknown or missing extensions through", async () => {
    expect(await checkFileContent(file(["anything"], "notes.txt"))).toBeNull();
    expect(
      await checkFileContent(file(["anything"], "noextension")),
    ).toBeNull();
  });
});
