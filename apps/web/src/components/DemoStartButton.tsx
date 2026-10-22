"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthSubmit } from "@/components/auth/AuthSubmit";

export function DemoStartButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/demo/start", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      return setError(data.error ?? "Could not start the demo.");
    }
    router.push("/office/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={start} className="space-y-4">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <AuthSubmit busy={busy} busyLabel="Preparing your demo…">
        Start the demo
      </AuthSubmit>
    </form>
  );
}
