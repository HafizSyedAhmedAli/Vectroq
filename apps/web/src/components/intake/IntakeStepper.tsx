// apps/web/src/components/intake/IntakeStepper.tsx
import { Check } from "lucide-react";

interface IntakeStepperProps {
  steps: readonly { id: string; label: string }[];
  current: number;
  /** Only completed steps are clickable (going back never skips validation). */
  onStepClick: (index: number) => void;
}

export function IntakeStepper({
  steps,
  current,
  onStepClick,
}: IntakeStepperProps) {
  return (
    <ol className="flex items-center gap-3 text-sm" aria-label="Progress">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li
            key={s.id}
            aria-current={active ? "step" : undefined}
            className="flex items-center gap-3 flex-1 last:flex-none"
          >
            <button
              type="button"
              disabled={!done}
              onClick={() => onStepClick(i)}
              className="flex items-center gap-3 cursor-pointer disabled:cursor-default"
            >
              <span
                className={`size-8 shrink-0 rounded-full grid place-items-center text-white text-sm font-semibold ${
                  done || active ? "bg-brand" : "bg-stone-400"
                }`}
              >
                {done ? <Check className="size-4" /> : i + 1}
              </span>
              <span
                className={`whitespace-nowrap font-medium ${
                  active
                    ? "inline text-brand"
                    : "hidden sm:inline text-stone-500"
                }`}
              >
                {s.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <span
                className={`h-px flex-1 ${done ? "bg-brand" : "bg-stone-200"}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
