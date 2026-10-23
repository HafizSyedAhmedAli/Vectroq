"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { AuthField } from "@/components/auth/AuthField";
import { AuthSubmit } from "@/components/auth/AuthSubmit";

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const EMAIL_KEY = "vq_remember_email";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [caps, setCaps] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(EMAIL_KEY);
      if (saved) setEmail(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;

    const trimmed = email.trim();
    const found: typeof errors = {};
    if (!trimmed) found.email = "Enter your email address.";
    else if (!EMAIL_RE.test(trimmed))
      found.email = "That doesn't look like a valid email.";
    if (!password) found.password = "Enter your password.";
    setErrors(found);
    setFormError(null);
    if (found.email) return emailRef.current?.focus();
    if (found.password) return passwordRef.current?.focus();

    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, password, remember }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error ?? "Could not log in.");
        setPassword("");
        setBusy(false);
        return passwordRef.current?.focus();
      }
      try {
        if (remember) localStorage.setItem(EMAIL_KEY, trimmed);
        else localStorage.removeItem(EMAIL_KEY);
      } catch {
        /* ignore */
      }
      router.push(next);
      router.refresh(); // keep the spinner until the page changes
    } catch {
      setFormError(
        "Can't reach the server. Check your connection and try again.",
      );
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <AuthField
        id="li-email"
        name="email"
        ref={emailRef}
        label="Email"
        type="email"
        autoComplete="username"
        placeholder="Enter your email address"
        icon={<Mail />}
        autoFocus
        value={email}
        error={errors.email}
        onChange={(e) => {
          setEmail(e.target.value);
          setErrors((p) => ({ ...p, email: undefined }));
          setFormError(null);
        }}
      />

      <AuthField
        id="li-pw"
        name="password"
        ref={passwordRef}
        label="Password"
        type={show ? "text" : "password"}
        autoComplete="current-password"
        placeholder="Enter your password"
        icon={<Lock />}
        value={password}
        error={errors.password}
        hint={caps ? "Caps Lock is on" : undefined}
        onChange={(e) => {
          setPassword(e.target.value);
          setErrors((p) => ({ ...p, password: undefined }));
          setFormError(null);
        }}
        onKeyUp={(e) => setCaps(e.getModifierState("CapsLock"))}
        onBlur={() => setCaps(false)}
        right={
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            className="grid size-9 cursor-pointer place-items-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        }
      />

      <div className="flex items-center justify-between text-sm">
        <label className="flex cursor-pointer select-none items-center gap-2 text-stone-600">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="size-4 cursor-pointer accent-brand"
          />
          Remember me
        </label>
        <Link
          href={`/forgot-password${email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ""}`}
          className="rounded font-medium text-brand hover:text-brand-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          Forgot your password?
        </Link>
      </div>

      {formError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <AuthSubmit busy={busy} busyLabel="Logging in…">
        Log in
      </AuthSubmit>
    </form>
  );
}
