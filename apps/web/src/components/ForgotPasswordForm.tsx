"use client";

import { useState, type FormEvent } from "react";
import { CircleAlert, Mail, MailCheck } from "lucide-react";
import { AuthField } from "@/components/auth/AuthField";
import { AuthSubmit } from "@/components/auth/AuthSubmit";

export function ForgotPasswordForm({
  initialEmail = "",
}: {
  initialEmail?: string;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const value = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(value)) {
      return setFieldError("Enter a valid email address.");
    }
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setFormError(data.error ?? "Something went wrong.");
      else setSentTo(value);
    } catch {
      setFormError(
        "Can't reach the server. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-green-200 bg-green-50 p-5 text-sm text-green-900"
      >
        <MailCheck className="size-6" />
        <p className="mt-3 font-semibold">Check your email</p>
        <p className="mt-1 leading-relaxed">
          If an account exists for <b>{sentTo}</b>, we&apos;ve sent a reset
          link. It expires in 1 hour. Check your spam folder too.
        </p>
        <button
          type="button"
          onClick={() => setSentTo(null)}
          className="mt-3 cursor-pointer text-xs font-semibold underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <AuthField
        id="fp-email"
        label="Email"
        type="email"
        autoComplete="username"
        placeholder="Enter your email address"
        icon={<Mail />}
        autoFocus
        value={email}
        error={fieldError}
        onChange={(e) => {
          setEmail(e.target.value);
          setFieldError(undefined);
        }}
      />
      {formError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}
      <AuthSubmit busy={busy} busyLabel="Sending…">
        Send reset link
      </AuthSubmit>
    </form>
  );
}
