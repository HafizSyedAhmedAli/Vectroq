"use client";

import { useState, type FormEvent } from "react";
import { CircleAlert, CircleCheck, Eye, EyeOff, Lock } from "lucide-react";
import { AuthField } from "@/components/auth/AuthField";
import { AuthSubmit } from "@/components/auth/AuthSubmit";

export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setDone(false);
    setError(null);
    setFieldError(undefined);

    if (next.length < 8)
      return setFieldError("Password must be at least 8 characters.");
    if (next !== confirm) return setFieldError("Passwords don't match.");

    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error ?? "Could not change password.");
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
    } catch {
      setError("Can't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const toggle = (
    <button
      type="button"
      onClick={() => setShow((s) => !s)}
      aria-label={show ? "Hide passwords" : "Show passwords"}
      aria-pressed={show}
      className="grid size-9 cursor-pointer place-items-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700"
    >
      {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  );
  const type = show ? "text" : "password";

  return (
    <form onSubmit={submit} noValidate className="max-w-md space-y-5">
      <AuthField
        id="cp-current"
        label="Current password"
        type={type}
        autoComplete="current-password"
        icon={<Lock />}
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        right={toggle}
      />
      <AuthField
        id="cp-new"
        label="New password (min 8 characters)"
        type={type}
        autoComplete="new-password"
        icon={<Lock />}
        value={next}
        onChange={(e) => {
          setNext(e.target.value);
          setFieldError(undefined);
        }}
      />
      <AuthField
        id="cp-confirm"
        label="Confirm new password"
        type={type}
        autoComplete="new-password"
        icon={<Lock />}
        value={confirm}
        error={fieldError}
        onChange={(e) => {
          setConfirm(e.target.value);
          setFieldError(undefined);
        }}
      />

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {done && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-3.5 py-3 text-sm text-green-800"
        >
          <CircleCheck className="mt-0.5 size-4 shrink-0" />
          Password changed. Your other devices were signed out.
        </p>
      )}

      <AuthSubmit busy={busy} busyLabel="Saving…" arrow={false}>
        Change password
      </AuthSubmit>
    </form>
  );
}
