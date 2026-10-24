"use client";

import { selectCls } from "./rates/field-styles";
import { useState } from "react";
import { Check, Copy, Link2, Loader2 } from "lucide-react";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

interface Share {
  token: string;
  expiresAt: string;
  label: string;
}

export function ShareLinkPanel({
  projectId,
  initial,
}: {
  projectId: string;
  initial: Share | null;
}) {
  const [share, setShare] = useState<Share | null>(initial);
  const [days, setDays] = useState("30");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expired = share ? new Date(share.expiresAt) < new Date() : false;
  const url = share ? `${window.location.origin}/client/${share.token}` : "";

  async function create() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days: Number(days) }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Could not create the link.");
    setShare({
      token: data.token,
      expiresAt: data.expiresAt,
      label: new Date(data.expiresAt).toLocaleDateString("en-PK", {
        dateStyle: "medium",
      }),
    });
  }

  async function revoke() {
    setBusy(true);
    await fetch(`/api/projects/${projectId}/share`, { method: "DELETE" });
    setBusy(false);
    setShare(null);
  }

  return (
    <section className="rounded-2xl border border-brand/20 bg-brand/5 p-5 shadow-sm">
      <h2 className="flex items-center gap-2 font-semibold text-brand-black">
        <Link2 className="size-4" /> Client share link
      </h2>
      <p className="mt-1 text-xs text-stone-500">
        Anyone with this link can see the 3D view, BOQ and your client&apos;s
        contact details until it expires.
      </p>

      {share && !expired && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            readOnly
            value={url}
            aria-label="Share link"
            className="h-10 min-w-0 flex-1 rounded-lg border border-stone-200 bg-stone-50 px-3 font-mono text-xs"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-stone-300 px-3 text-sm font-semibold hover:bg-stone-50"
          >
            {copied ? (
              <Check className="size-4" />
            ) : (
              <Copy className="size-4" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
      {share && (
        <p
          className={`mt-2 text-xs ${expired ? "text-red-600" : "text-stone-500"}`}
        >
          {expired ? "Expired" : "Expires"} {share.label}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="w-40">
          <NativeSelect
            aria-label="Link duration"
            className={selectCls}
            value={days}
            onChange={(e) => setDays(e.target.value)}
          >
            <NativeSelectOption value="7">7 days</NativeSelectOption>
            <NativeSelectOption value="30">30 days</NativeSelectOption>
            <NativeSelectOption value="90">90 days</NativeSelectOption>
          </NativeSelect>
        </div>
        <button
          type="button"
          onClick={create}
          disabled={busy}
          className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          {share ? "Replace link" : "Create link"}
        </button>
        {share && (
          <button
            type="button"
            onClick={revoke}
            disabled={busy}
            className="cursor-pointer text-sm text-stone-500 underline"
          >
            Revoke
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
