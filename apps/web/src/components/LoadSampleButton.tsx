"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

export function LoadSampleButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/onboarding/sample-project", {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      return setError(data.error ?? "Could not load the sample project.");
    }
    router.push(`/office/${data.projectId}`);
  }

  return (
    <div>
      <button
        type="button"
        onClick={load}
        disabled={busy}
        className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-wait disabled:opacity-70"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Sparkles className="size-4" />
        )}
        {busy ? "Loading…" : "Load sample project"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
