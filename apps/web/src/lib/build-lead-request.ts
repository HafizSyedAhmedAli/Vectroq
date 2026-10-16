import type { LeadIntakeInput } from "@vectroq/lead-intake";

export function buildLeadRequest(
  data: LeadIntakeInput,
  planFile: File | null,
  orgSlug: string,
): RequestInit {
  const payload = { ...data, orgSlug };
  if (!planFile) {
    return {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    };
  }
  const form = new FormData();
  form.append("data", JSON.stringify(payload));
  form.append("file", planFile);
  return { method: "POST", body: form };
}
