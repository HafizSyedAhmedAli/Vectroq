import type { ReactNode } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

export function AuthSubmit({
  busy,
  busyLabel,
  children,
  arrow = true,
}: {
  busy: boolean;
  busyLabel: string;
  children: ReactNode;
  arrow?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={busy}
      aria-busy={busy}
      className="group inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand to-sky-500 text-[15px] font-semibold text-white shadow-lg shadow-brand/30 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30 active:translate-y-0 active:scale-[0.99] disabled:cursor-wait disabled:opacity-90 disabled:hover:translate-y-0"
    >
      {busy && <Loader2 className="size-4 animate-spin" />}
      {busy ? busyLabel : children}
      {!busy && arrow && (
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
      )}
    </button>
  );
}
