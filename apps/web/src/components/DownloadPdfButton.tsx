"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

interface Props {
  href: string;
  variant?: "primary" | "card";
}

export function DownloadPdfButton({ href, variant = "primary" }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(href);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not create the PDF.");
      }
      const blob = await res.blob();
      const name =
        /filename="([^"]+)"/.exec(
          res.headers.get("Content-Disposition") ?? "",
        )?.[1] ?? "BOQ.pdf";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create the PDF.",
      );
    } finally {
      setBusy(false);
    }
  }

  const Icon = busy ? Loader2 : Download;
  const iconCls = `size-5 ${busy ? "animate-spin" : ""}`;

  return (
    <div className="print:hidden">
      {variant === "primary" ? (
        <button
          type="button"
          onClick={download}
          disabled={busy}
          aria-busy={busy}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-wait disabled:opacity-80"
        >
          <Icon className={iconCls.replace("size-5", "size-4")} />
          {busy ? "Preparing PDF…" : "Download PDF"}
        </button>
      ) : (
        <button
          type="button"
          onClick={download}
          disabled={busy}
          aria-busy={busy}
          className="mt-6 flex w-full cursor-pointer items-center gap-4 rounded-2xl bg-red-50 px-4 py-4 text-left transition hover:bg-red-100/70 disabled:cursor-wait"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-brand shadow-sm">
            <Icon className={iconCls} />
          </span>
          <span>
            <span className="block text-sm font-semibold text-brand">
              {busy ? "Preparing your PDF…" : "Download PDF"}
            </span>
            <span className="block text-xs leading-snug text-stone-500">
              {busy
                ? "This can take a few seconds. Please keep this page open."
                : "Download the project details and cost estimate."}
            </span>
          </span>
        </button>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}