"use client";

export function PrintButton({
  label = "Print / Save as PDF",
}: {
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark cursor-pointer"
    >
      {label}
    </button>
  );
}
