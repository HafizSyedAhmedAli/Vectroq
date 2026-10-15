// apps/web/src/lib/build-lead-request.ts
import type { LeadIntakeInput } from "@tmcc/lead-intake";

export function buildLeadRequest(
  data: LeadIntakeInput,
  planFile: File | null,
): RequestInit {
  if (!planFile) {
    return {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };
  }
  const form = new FormData(); // browser sets the multipart boundary itself
  form.append("data", JSON.stringify(data));
  form.append("file", planFile);
  return { method: "POST", body: form };
}
