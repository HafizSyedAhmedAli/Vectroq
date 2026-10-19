"use client";

import type { EngagementModel } from "@vectroq/shared-types";
import { modelOptionsFromRules } from "./option-config";
import { IntakeForm, type IntakeSubmitResult } from "@/components/IntakeForm";
import { buildLeadRequest } from "@/lib/build-lead-request";
import type { LeadIntakeInput } from "@vectroq/lead-intake";

export function PublicIntake({
  orgSlug,
  models,
}: {
  orgSlug: string;
  models: Record<EngagementModel, { label: string; description: string }>;
}) {
  async function handleSubmit(
    data: LeadIntakeInput,
    planFile: File | null,
  ): Promise<IntakeSubmitResult> {
    const res = await fetch(
      "/api/leads",
      buildLeadRequest(data, planFile, orgSlug),
    );
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      const messages = body?.errors
        ? Object.values(body.errors as Record<string, string>).join(" ")
        : (body?.error ?? "");
      throw new Error(messages || "Failed to submit lead");
    }
    return { estimate: body.estimate };
  }

  return (
    <IntakeForm
      onSubmit={handleSubmit}
      modelOptions={modelOptionsFromRules(models)}
    />
  );
}
