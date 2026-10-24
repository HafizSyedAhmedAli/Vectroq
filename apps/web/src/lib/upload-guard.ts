import { planFileExtension, sniffPlanFile } from "@vectroq/lead-intake";

/** Reads the first 4 KB of an upload and checks it against the extension. */
export async function checkFileContent(
  file: File,
  ext: string = planFileExtension(file.name),
): Promise<string | null> {
  const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  return sniffPlanFile(head, ext);
}
