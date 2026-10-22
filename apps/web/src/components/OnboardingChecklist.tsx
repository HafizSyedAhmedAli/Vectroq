import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import type { OnboardingStep } from "@/lib/onboarding";
import { LoadSampleButton } from "./LoadSampleButton";

export function OnboardingChecklist({
  steps,
  canLoadSample,
}: {
  steps: OnboardingStep[];
  canLoadSample: boolean;
}) {
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);

  return (
    <section className="mt-8 rounded-2xl border border-brand/20 bg-white p-5 shadow-[0_10px_40px_-12px_rgba(15,23,42,0.10)] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-brand-black">Get set up</h2>
          <p className="text-sm text-stone-500">
            {done} of {steps.length} steps done
          </p>
        </div>
        {canLoadSample && <LoadSampleButton />}
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-100">
        <span
          className="block h-full bg-brand transition-all"
          style={{ width: `${(done / steps.length) * 100}%` }}
        />
      </div>

      <ol className="mt-5 space-y-2">
        {steps.map((s) => (
          <li
            key={s.id}
            className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${
              s.id === next?.id
                ? "border-brand/40 bg-brand/5"
                : "border-stone-200"
            }`}
          >
            <span
              className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                s.done
                  ? "bg-green-100 text-green-700"
                  : "bg-stone-100 text-stone-500"
              }`}
            >
              {s.done ? <Check className="size-4" /> : steps.indexOf(s) + 1}
            </span>
            <div className="min-w-0 flex-1 basis-56">
              <p className="text-sm font-semibold text-brand-black">
                {s.title}
              </p>
              <p className="text-xs text-stone-500">{s.text}</p>
            </div>
            {!s.done && (
              <Link
                href={s.href}
                target={s.external ? "_blank" : undefined}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-dark"
              >
                {s.cta} <ArrowRight className="size-4" />
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
