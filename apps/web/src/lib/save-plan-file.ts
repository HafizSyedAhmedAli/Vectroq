import { put } from "@vercel/blob";
import { planFileExtension } from "@tmcc/lead-intake";

export async function savePlanFile(
  leadId: string,
  file: File,
): Promise<string> {
  const blob = await put(
    `lead-plans/${leadId}.${planFileExtension(file.name)}`,
    file,
    { access: "public", addRandomSuffix: true },
  );
  return blob.url;
}