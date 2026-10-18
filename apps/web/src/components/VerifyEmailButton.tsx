"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthSubmit } from "@/components/auth/AuthSubmit";

export function VerifyEmailButton({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      return setError(data.error ?? "Could not confirm your email.");
    }
    router.push("/office/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <AuthSubmit busy={busy} busyLabel="Confirming…">
        Confirm my email
      </AuthSubmit>
    </form>
  );
}
