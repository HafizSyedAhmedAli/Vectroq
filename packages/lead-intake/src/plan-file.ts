// packages/lead-intake/src/plan-file.ts
// Pure (no Node/DOM APIs) so the browser and the API route share one rule set.

export const PLAN_FILE_EXTENSIONS = [
  "pdf",
  "dwg",
  "dxf",
  "jpg",
  "jpeg",
  "png",
] as const;
export const PLAN_FILE_MAX_BYTES = 10 * 1024 * 1024;

export function planFileExtension(name: string): string {
  return name.includes(".") ? (name.split(".").pop() ?? "").toLowerCase() : "";
}

export function validatePlanFile(file: {
  name: string;
  size: number;
}): string | null {
  const ext = planFileExtension(file.name);
  if (!(PLAN_FILE_EXTENSIONS as readonly string[]).includes(ext)) {
    return `Unsupported file type. Use ${PLAN_FILE_EXTENSIONS.map((e) => e.toUpperCase()).join(", ")}.`;
  }
  if (file.size === 0) return "That file is empty.";
  if (file.size > PLAN_FILE_MAX_BYTES) return "File is larger than 10 MB.";
  return null;
}

const startsWith = (b: Uint8Array, sig: number[]) =>
  b.length >= sig.length && sig.every((v, i) => b[i] === v);

const ascii = (b: Uint8Array, n: number) =>
  Array.from(b.slice(0, n), (c) => String.fromCharCode(c)).join("");

const MISMATCH = "The file's contents don't match its extension.";

/** Checks the first bytes of a file against what its extension claims. Pure. */
export function sniffPlanFile(head: Uint8Array, ext: string): string | null {
  switch (ext) {
    case "pdf":
      return ascii(head, 1024).includes("%PDF") ? null : MISMATCH;
    case "png":
      return startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        ? null
        : MISMATCH;
    case "jpg":
    case "jpeg":
      return startsWith(head, [0xff, 0xd8, 0xff]) ? null : MISMATCH;
    case "dwg":
      return ascii(head, 4) === "AC10" ? null : MISMATCH;
    case "dxf": {
      if (head.includes(0))
        return "Binary DXF files aren't supported. Save as ASCII DXF.";
      return ascii(head, 4096).includes("SECTION") ? null : MISMATCH;
    }
    default:
      return null;
  }
}
