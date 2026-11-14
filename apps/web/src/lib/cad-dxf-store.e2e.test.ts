// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const put = vi.fn(), get = vi.fn(), del = vi.fn();
vi.mock("@vercel/blob", () => ({
  put: (...a: unknown[]) => put(...a),
  get: (...a: unknown[]) => get(...a),
  del: (...a: unknown[]) => del(...a),
}));
import { deleteCadDxf, dxfStorageBackend, readCadDxf, saveCadDxf } from "./cad-dxf-store";

const DB = "postgresql://postgres:test@localhost:54330/vectroq_test";
const KEYS = ["E2E_DXF_STORAGE", "E2E_DXF_STORAGE_DIR", "VECTROQ_E2E", "DATABASE_URL", "DIRECT_URL", "VERCEL", "VERCEL_ENV", "VERCEL_URL"];
let saved: Record<string, string | undefined>;
let dir: string;

beforeEach(async () => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
  put.mockReset(); get.mockReset(); del.mockReset();
  dir = await mkdtemp(join(tmpdir(), "vq-dxf-"));
});
afterEach(async () => {
  for (const k of KEYS) saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]);
  await rm(dir, { recursive: true, force: true });
});

function enableE2E() {
  Object.assign(process.env, {
    VECTROQ_E2E: "1", E2E_DXF_STORAGE: "filesystem", E2E_DXF_STORAGE_DIR: dir,
    DATABASE_URL: DB, DIRECT_URL: DB,
  });
}

describe("DXF storage backend selection", () => {
  it("defaults to Vercel Blob", async () => {
    expect(dxfStorageBackend()).toEqual({ kind: "blob" });
    put.mockResolvedValue({ pathname: "cad-dxf/p1-x.dxf" });
    await saveCadDxf("p1", "DXF");
    expect(put).toHaveBeenCalledTimes(1);
  });
  it("stays on Blob when only the E2E flag or a test DB is present", () => {
    process.env.VECTROQ_E2E = "1";
    process.env.DATABASE_URL = DB;
    expect(dxfStorageBackend()).toEqual({ kind: "blob" });
  });
  it("uses the filesystem only with the full explicit configuration", () => {
    enableE2E();
    expect(dxfStorageBackend()).toEqual({ kind: "filesystem", dir });
  });
  it("fails closed (throws, never falls back to Blob) when requested unsafely", async () => {
    process.env.E2E_DXF_STORAGE = "filesystem";
    process.env.E2E_DXF_STORAGE_DIR = dir;
    expect(() => dxfStorageBackend()).toThrow(/VECTROQ_E2E/); // no flag
    enableE2E();
    process.env.VERCEL = "1";
    expect(() => dxfStorageBackend()).toThrow(/Vercel/);
    delete process.env.VERCEL;
    process.env.DATABASE_URL = "postgresql://u:p@db.neon.tech/prod";
    expect(() => dxfStorageBackend()).toThrow(/DATABASE_URL/);
    await expect(saveCadDxf("p1", "x")).rejects.toThrow();
    expect(put).not.toHaveBeenCalled();
  });
  it("rejects unknown modes and a missing directory", () => {
    process.env.E2E_DXF_STORAGE = "memory";
    expect(() => dxfStorageBackend()).toThrow(/Unknown/);
    enableE2E();
    delete process.env.E2E_DXF_STORAGE_DIR;
    expect(() => dxfStorageBackend()).toThrow(/E2E_DXF_STORAGE_DIR/);
  });
});

describe("filesystem backend", () => {
  it("round-trips save / read / delete without touching Blob", async () => {
    enableE2E();
    const key = await saveCadDxf("proj1", "0\nSECTION\n");
    expect(key).toMatch(/^cad-dxf\/proj1-[0-9a-f]{12}\.dxf$/);
    await expect(readCadDxf(key)).resolves.toBe("0\nSECTION\n");
    await deleteCadDxf(key);
    await expect(readCadDxf(key)).resolves.toBeNull();
    await deleteCadDxf(key); // already gone: still fine
    expect(put).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
    expect(await readdir(dir)).toContain(".vectroq-e2e-dxf-store");
  });
  it("refuses keys that escape the store", async () => {
    enableE2E();
    await expect(readCadDxf("../../etc/passwd")).rejects.toThrow(/escapes/);
    await expect(saveCadDxf("../x", "d")).rejects.toThrow(/Unsafe/);
  });
});
