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
