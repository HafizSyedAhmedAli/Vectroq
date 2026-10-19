"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Loader2, TriangleAlert } from "lucide-react";

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  busyLabel = "Working…",
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  busyLabel?: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md animate-fade-up rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
            <TriangleAlert className="size-5" />
          </span>
          <div>
            <h3
              id="confirm-title"
              className="text-lg font-bold text-brand-black"
            >
              {title}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-stone-600">
              {message}
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="h-10 cursor-pointer rounded-xl border border-stone-300 px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-wait disabled:opacity-70"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
