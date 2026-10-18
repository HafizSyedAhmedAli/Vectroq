"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthSubmit } from "./auth/AuthSubmit";

export function AcceptInviteForm({
  token,
  hasAccount,
}: {
  token: string;
  hasAccount: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      return setError(data.error ?? "Could not accept the invitation.");
    }
    router.push("/office");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {!hasAccount && (
        <div>
          <Label htmlFor="inv-name">Your name</Label>
          <Input
            id="inv-name"
            className="mt-1.5 h-11"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      )}
      <div>
        <Label htmlFor="inv-pw">
          {hasAccount
            ? "Your existing password"
            : "Choose a password (min 8 characters)"}
        </Label>
        <Input
          id="inv-pw"
          type="password"
          className="mt-1.5 h-11"
          autoComplete={hasAccount ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <AuthSubmit busy={busy} busyLabel="Joining…" arrow={false}>
        Join team
      </AuthSubmit>
    </form>
  );
}
