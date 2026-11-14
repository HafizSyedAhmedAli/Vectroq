import { del, get, put } from "@vercel/blob";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { assertE2EMode } from "./e2e-guard";

// Original DXF storage. Production uses Vercel Blob. For browser (E2E) tests only,
// the same three operations can run on a local folder instead, so the real upload
// flow can be exercised without a Blob token. That backend is chosen ONLY when
//   VECTROQ_E2E=1  and  E2E_DXF_STORAGE=filesystem  and  E2E_DXF_STORAGE_DIR=<dir>
// are all set, and only when the process points at a local `*_test` database and
// is not on Vercel (see e2e-guard.ts). Anything else that sets E2E_DXF_STORAGE
// throws instead of falling back, so a misconfigured deployment fails closed.

const token = () => process.env.PLANS_READ_WRITE_TOKEN;

const MARKER = ".vectroq-e2e-dxf-store";

type Backend = { kind: "blob" } | { kind: "filesystem"; dir: string };

/** Which backend this process uses. Throws when E2E storage is requested unsafely. */
export function dxfStorageBackend(env = process.env): Backend {
  const mode = env.E2E_DXF_STORAGE;
  if (mode === undefined || mode === "") return { kind: "blob" };
  if (mode !== "filesystem")
    throw new Error(`Unknown E2E_DXF_STORAGE "${mode}" (only "filesystem" is supported).`);
  assertE2EMode(env);
  const dir = env.E2E_DXF_STORAGE_DIR;
  if (!dir) throw new Error("E2E_DXF_STORAGE=filesystem needs E2E_DXF_STORAGE_DIR.");
  return { kind: "filesystem", dir: resolve(dir) };
}

function fsPath(dir: string, key: string): string {
  const full = resolve(dir, key);
  if (!full.startsWith(dir + sep)) throw new Error(`DXF key escapes the store: ${key}`);
  return full;
}

export async function saveCadDxf(projectId: string, dxfText: string): Promise<string> {
  const backend = dxfStorageBackend();
  if (backend.kind === "filesystem") {
    if (!/^[A-Za-z0-9_-]+$/.test(projectId)) throw new Error("Unsafe project id for the E2E DXF store.");
    const key = `cad-dxf/${projectId}-${randomBytes(6).toString("hex")}.dxf`;
    const file = fsPath(backend.dir, key);
    await mkdir(resolve(file, ".."), { recursive: true });
    await writeFile(resolve(backend.dir, MARKER), "vectroq e2e dxf store\n");
    await writeFile(file, dxfText, "utf8");
    return key;
  }
  const blob = await put(`cad-dxf/${projectId}.dxf`, dxfText, {
    access: "private",
    addRandomSuffix: true,
    contentType: "application/octet-stream",
    token: token(),
  });
  return blob.pathname;
}

export async function readCadDxf(key: string): Promise<string | null> {
  const backend = dxfStorageBackend();
  if (backend.kind === "filesystem") {
    try {
      return await readFile(fsPath(backend.dir, key), "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }
  const result = await get(key, { access: "private", token: token() });
  if (!result || result.statusCode !== 200) return null;
  return await new Response(result.stream).text();
}

/** Best effort: a failed delete is logged, never thrown. */
export async function deleteCadDxf(key: string | null | undefined) {
  if (!key) return;
  try {
    const backend = dxfStorageBackend();
    if (backend.kind === "filesystem") {
      await unlink(fsPath(backend.dir, key)).catch((e) => {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      });
      return;
    }
    await del(key, { token: token() });
  } catch (err) {
    console.error("Could not delete old DXF blob", key, err);
  }
}
