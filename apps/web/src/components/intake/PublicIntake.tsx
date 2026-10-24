"use client";

import { useCallback, useRef, useState } from "react";
import type { Category, EngagementModel } from "@vectroq/shared-types";
import {
  categoryOptionsFromRules,
  modelOptionsFromRules,
} from "./option-config";
import { IntakeForm, type IntakeSubmitResult } from "@/components/IntakeForm";
import { buildLeadRequest } from "@/lib/build-lead-request";
import type { LeadIntakeInput } from "@vectroq/lead-intake";
import { TurnstileWidget } from "./TurnstileWidget";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function PublicIntake({
  orgSlug,
  models,
  categories,
}: {
  orgSlug: string;
  models: Record<EngagementModel, { label: string; description: string }>;
  categories: Record<Category, { label: string }>;
}) {
  const [openedAt] = useState(() => Date.now());
  const [challenge, setChallenge] = useState(0);
  const honeypot = useRef<HTMLInputElement>(null);
  const token = useRef("");
  const setToken = useCallback((t: string) => {
    token.current = t;
  }, []);

  async function handleSubmit(
    data: LeadIntakeInput,
    planFile: File | null,
  ): Promise<IntakeSubmitResult> {
    try {
      const res = await fetch(
        "/api/leads",
        buildLeadRequest(data, planFile, orgSlug, {
          website: honeypot.current?.value ?? "",
          elapsedMs: Date.now() - openedAt,
          turnstileToken: token.current,
        }),
      );
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        const messages = body?.errors
          ? Object.values(body.errors as Record<string, string>).join(" ")
          : (body?.error ?? "");
        throw new Error(messages || "Failed to submit lead");
      }
      return { estimate: body.estimate };
    } finally {
      // Turnstile tokens are single-use: get a fresh one for the next attempt.
      token.current = "";
      if (SITE_KEY) setChallenge((c) => c + 1);
    }
  }

  return (
    <div className="relative">
      {/* Honeypot: invisible to people, tempting to bots. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-10000px",
          width: 1,
          height: 1,
          overflow: "hidden",
        }}
      >
        <label>
          Website
          <input
            ref={honeypot}
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
      </div>

      <IntakeForm
        onSubmit={handleSubmit}
        modelOptions={modelOptionsFromRules(models)}
        categoryOptions={categoryOptionsFromRules(categories)}
      />

      {SITE_KEY && (
        <TurnstileWidget
          key={challenge}
          siteKey={SITE_KEY}
          onToken={setToken}
        />
      )}
    </div>
  );
}
