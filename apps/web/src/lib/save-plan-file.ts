import { put } from "@vercel/blob";
import { planFileExtension } from "@vectroq/lead-intake";

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  dxf: "application/octet-stream",
  dwg: "application/octet-stream",
};

/** Returns the private blob PATHNAME (not a URL). Read it via /api/leads/[id]/plan. */
export async function savePlanFile(
  leadId: string,
  file: File,
): Promise<string> {
  const ext = planFileExtension(file.name);
  const blob = await put(`lead-plans/${leadId}.${ext}`, file, {
    access: "private",
    addRandomSuffix: true,
    contentType: CONTENT_TYPES[ext] ?? "application/octet-stream",
    token: process.env.PLANS_READ_WRITE_TOKEN,
  });
  return blob.pathname;
}
