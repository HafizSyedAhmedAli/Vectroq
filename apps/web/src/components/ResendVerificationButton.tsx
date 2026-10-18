"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";

export function ResendVerificationButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(
    null,
  );

  async function send() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/verify-email/send", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({
          text: data.error ?? "Could not send the email.",
          ok: false,
        });
      } else if (data.alreadyVerified) {
        setMessage({ text: "Already confirmed. Refresh the page.", ok: true });
      } else {
        setMessage({
          text: data.emailed
            ? "Email sent. Check your inbox and spam folder."
            : "Email service isn't configured. In development the link is printed in the server console.",
          ok: true,
        });
      }
    } catch {
      setMessage({ text: "Can't reach the server.", ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={send}
        disabled={busy}
        className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-wait disabled:opacity-70"
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Send className="size-3.5" />
        )}
        Resend email
      </button>
      {message && (
        <span
          role={message.ok ? "status" : "alert"}
          className={`text-xs ${message.ok ? "text-green-800" : "text-red-700"}`}
        >
          {message.text}
        </span>
      )}
    </span>
  );
}
