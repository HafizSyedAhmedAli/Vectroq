import { put } from "@vercel/blob";
import { planFileExtension } from "@vectroq/lead-intake";

/** Returns the private blob PATHNAME (not a URL). Read it via /api/leads/[id]/plan. */
export async function savePlanFile(
  leadId: string,
  file: File,
): Promise<string> {
  const blob = await put(
    `lead-plans/${leadId}.${planFileExtension(file.name)}`,
    file,
    {
      access: "private",
      addRandomSuffix: true,
      token: process.env.PLANS_READ_WRITE_TOKEN,
    },
  );
  return blob.pathname;
}
