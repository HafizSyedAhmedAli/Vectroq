// apps/web/src/components/intake/ThankYou.tsx
import { Check, Home, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { estimateRange } from "@/lib/boq-format";
import type { IntakeSubmitResult } from "./types";

export function ThankYou({
  result,
  onReset,
}: {
  result: IntakeSubmitResult;
  onReset: () => void;
}) {
  return (
    <div className="max-w-xl mx-auto bg-white border border-stone-200 rounded-2xl shadow-sm p-8 text-center">
      <span className="mx-auto grid size-20 place-items-center rounded-full bg-red-100">
        <span className="grid size-12 place-items-center rounded-full bg-brand text-white">
          <Check className="size-7" />
        </span>
      </span>
      <h2 className="mt-5 text-3xl font-extrabold text-brand-black">
        Thank You!
      </h2>
      <p className="text-xl font-bold text-brand">
        Your Request Has Been Submitted
      </p>
      <p className="mt-3 text-sm text-stone-600">
        We&apos;ve received your details and will be in touch shortly with a
        personalized response.
      </p>

      <div className="mt-5 flex items-center gap-3 rounded-xl border border-red-100 bg-red-50/50 px-4 py-3 text-left text-sm text-stone-700">
        <Mail className="size-5 shrink-0 text-brand" />
        Our team will review your information and get back to you as soon as
        possible.
      </div>

      {result.estimate ? (
        <div className="mt-5 border-t border-stone-200 pt-5">
          <p className="text-sm text-stone-500 mb-1">
            Rough starting range for your area and category
          </p>
          <p className="text-2xl font-bold text-brand-black">
            {estimateRange(result.estimate.total)}
          </p>
          <p className="text-xs text-stone-400 mt-2">
            A ballpark for a typical house of this size — not a quote. Your
            exact BOQ will follow once we have reviewed your plot and drawings.
          </p>
        </div>
      ) : (
        <p className="text-xs text-stone-400 mt-4">
          We don&apos;t have pricing set up for your area yet — a representative
          will follow up with a custom quote.
        </p>
      )}

      <Button
        type="button"
        onClick={onReset}
        className="mt-6 h-11 bg-brand hover:bg-brand-dark text-white cursor-pointer"
      >
        <Home className="size-4" />
        Back to Homepage
      </Button>
    </div>
  );
}
