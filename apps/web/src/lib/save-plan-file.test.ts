import { describe, it, expect, vi, beforeEach } from "vitest";

const put = vi.fn();
vi.mock("@vercel/blob", () => ({ put: (...a: unknown[]) => put(...a) }));

import { savePlanFile } from "./save-plan-file";

beforeEach(() => {
  put.mockReset();
  put.mockResolvedValue({ pathname: "lead-plans/L1-abc.pdf" });
});

describe("savePlanFile", () => {
  it("uploads privately with the right path/content type and returns the pathname", async () => {
    const file = new File(["x"], "My Plan.PDF");
    await expect(savePlanFile("L1", file)).resolves.toBe("lead-plans/L1-abc.pdf");
    expect(put).toHaveBeenCalledWith("lead-plans/L1.pdf", file, expect.objectContaining({
      access: "private", addRandomSuffix: true, contentType: "application/pdf",
    }));
  });
  it.each([["a.png", "image/png"], ["a.jpg", "image/jpeg"], ["a.jpeg", "image/jpeg"], ["a.dxf", "application/octet-stream"], ["a.dwg", "application/octet-stream"]])(
    "maps %s to %s", async (name, type) => {
      await savePlanFile("L", new File(["x"], name));
      expect(put.mock.calls[0][2].contentType).toBe(type);
    });
  it("falls back to octet-stream for unknown extensions", async () => {
    await savePlanFile("L", new File(["x"], "a.xyz"));
    expect(put.mock.calls[0][2].contentType).toBe("application/octet-stream");
  });
});
