import type { LeadIntakeInput } from "@vectroq/lead-intake";

export interface BotPayload {
  website: string;
  elapsedMs: number;
  turnstileToken: string;
}

export function buildLeadRequest(
  data: LeadIntakeInput,
  planFile: File | null,
  orgSlug: string,
  bot?: BotPayload,
): RequestInit {
  const payload = { ...data, orgSlug, bot };
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
