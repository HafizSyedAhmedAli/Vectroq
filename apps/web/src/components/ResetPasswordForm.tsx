"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthSubmit } from "@/components/auth/AuthSubmit";
import { darkAlert, darkInput, darkLabel } from "@/components/auth/dark-styles";

const inputCls = `h-12 rounded-xl border-stone-200! bg-white! pl-11 pr-12 text-[15px] shadow-sm focus-visible:border-brand! focus-visible:ring-brand/20 ${darkInput}`;

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setError("Passwords don't match.");
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      setExpired(res.status === 410);
      return setError(data.error ?? "Could not reset your password.");
    }
    router.push("/login?reset=1");
  }

  const field = (
    id: string,
    label: string,
    value: string,
    set: (v: string) => void,
  ) => (
    <div>
      <Label htmlFor={id} className={`text-sm font-semibold ${darkLabel}`}>
        {label}
      </Label>
      <div className="relative mt-2">
        <Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-stone-400 dark:text-slate-500" />
        <Input
          id={id}
          type={show ? "text" : "password"}
          autoComplete="new-password"
          className={inputCls}
          value={value}
          onChange={(e) => set(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide passwords" : "Show passwords"}
          className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-white"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-5">
      {field("rp-pw", "New password (min 8 characters)", password, setPassword)}
      {field("rp-confirm", "Confirm new password", confirm, setConfirm)}
      {error && (
        <p
          role="alert"
          className={`rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 ${darkAlert}`}
        >
          {error}{" "}
          {expired && (
            <Link href="/forgot-password" className="font-semibold underline">
              Request a new link
            </Link>
          )}
        </p>
      )}
      <AuthSubmit busy={busy} busyLabel="Saving…" arrow={false}>
        Set new password
      </AuthSubmit>
    </form>
  );
}
