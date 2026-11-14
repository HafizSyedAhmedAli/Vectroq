import { describe, it, expect, vi, beforeEach } from "vitest";

const put = vi.fn(), get = vi.fn(), del = vi.fn();
vi.mock("@vercel/blob", () => ({
  put: (...a: unknown[]) => put(...a),
  get: (...a: unknown[]) => get(...a),
  del: (...a: unknown[]) => del(...a),
}));
import { deleteCadDxf, readCadDxf, saveCadDxf } from "./cad-dxf-store";

beforeEach(() => { put.mockReset(); get.mockReset(); del.mockReset(); });

describe("cad dxf store", () => {
  it("saves privately and returns the pathname", async () => {
    put.mockResolvedValue({ pathname: "cad-dxf/p1-abc.dxf" });
    await expect(saveCadDxf("p1", "DXF")).resolves.toBe("cad-dxf/p1-abc.dxf");
    expect(put).toHaveBeenCalledWith("cad-dxf/p1.dxf", "DXF", expect.objectContaining({ access: "private", addRandomSuffix: true }));
  });
  it("reads the text back", async () => {
    get.mockResolvedValue({ statusCode: 200, stream: new Response("HELLO").body });
    await expect(readCadDxf("k")).resolves.toBe("HELLO");
    expect(get).toHaveBeenCalledWith("k", expect.objectContaining({ access: "private" }));
  });
  it("returns null when the blob is missing", async () => {
    get.mockResolvedValue(null);
    await expect(readCadDxf("k")).resolves.toBeNull();
    get.mockResolvedValue({ statusCode: 304 });
    await expect(readCadDxf("k")).resolves.toBeNull();
  });
  it("delete is best-effort and skips empty keys", async () => {
    await deleteCadDxf(null);
    expect(del).not.toHaveBeenCalled();
    del.mockRejectedValue(new Error("boom"));
    await expect(deleteCadDxf("k")).resolves.toBeUndefined();
  });
});
