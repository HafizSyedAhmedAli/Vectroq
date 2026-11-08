// Original-DXF storage. Same private-blob conventions as lib/save-plan-file.ts:
// private access, PLANS_READ_WRITE_TOKEN, and the PATHNAME (not a URL) is what
// the database keeps. Needed so a unit confirmation can re-parse the untouched file.
import { del, get, put } from "@vercel/blob";

const token = () => process.env.PLANS_READ_WRITE_TOKEN;

/** Stores the original DXF text; returns the private blob pathname. */
export async function saveCadDxf(
  projectId: string,
  dxfText: string,
): Promise<string> {
  const blob = await put(`cad-dxf/${projectId}.dxf`, dxfText, {
    access: "private",
    addRandomSuffix: true,
    contentType: "application/octet-stream",
    token: token(),
  });
  return blob.pathname;
}

/** Reads a stored DXF back as text, or null when the blob is gone. */
export async function readCadDxf(key: string): Promise<string | null> {
  const result = await get(key, { access: "private", token: token() });
  if (!result || result.statusCode !== 200) return null;
  return await new Response(result.stream).text();
}

/** Best-effort removal of a replaced DXF. Never throws: a leftover blob is harmless. */
export async function deleteCadDxf(key: string | null | undefined) {
  if (!key) return;
  try {
    await del(key, { token: token() });
  } catch (err) {
    console.error("Could not delete old DXF blob", key, err);
  }
}
