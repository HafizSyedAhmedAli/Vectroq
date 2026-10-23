// apps/web/src/components/intake/OptionCards.tsx
"use client";

import { useId } from "react";
import type { LucideIcon } from "lucide-react";
import { FieldError, Radio, RequiredMark } from "./fields";

export interface CardOption<T extends string | number> {
  value: T;
  label: string;
  description?: string;
  Icon?: LucideIcon;
}

interface OptionCardsProps<T extends string | number> {
  legend: string;
  options: readonly CardOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  required?: boolean;
  error?: string;
  /** Tailwind grid-cols classes, e.g. "sm:grid-cols-3". */
  columnsClass?: string;
}

const card =
  "rounded-2xl border p-4 text-left transition cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20";
const cardOn =
  "border-brand bg-brand/5 ring-1 ring-brand shadow-md shadow-brand/10";
const cardOff =
  "border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm";

// Icon bubble colours, cycled by position (the first one follows the brand).
const BUBBLE = [
  "bg-brand/10 text-brand",
  "bg-blue-50 text-blue-600",
  "bg-purple-50 text-purple-600",
];

// A radio group rendered as selectable cards. With a description it shows the
// tall card layout; without one, a compact single-row pill.
export function OptionCards<T extends string | number>({
  legend,
  options,
  value,
  onChange,
  required,
  error,
  columnsClass = "sm:grid-cols-3",
}: OptionCardsProps<T>) {
  const legendId = useId();
  return (
    <div>
      <p id={legendId} className="text-sm font-medium">
        {legend} {required && <RequiredMark />}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={legendId}
        className={`mt-2 grid gap-3 ${columnsClass}`}
      >
        {options.map(
          ({ value: optionValue, label, description, Icon }, index) => {
            const on = value === optionValue;
            const style = `${card} ${on ? cardOn : cardOff}`;
            return (
              <button
                key={String(optionValue)}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onChange(optionValue)}
                className={style}
              >
                {description ? (
                  <>
                    <div className="flex items-start justify-between">
                      {Icon && (
                        <span
                          className={`grid size-12 place-items-center rounded-full ${BUBBLE[index % BUBBLE.length]}`}
                        >
                          <Icon className="size-6" />
                        </span>
                      )}
                      <Radio on={on} />
                    </div>
                    <p className="mt-3 text-sm font-bold text-brand-black">
                      {label}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-stone-500">
                      {description}
                    </p>
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-2 py-0.5">
                    <span className="flex items-center gap-2 text-sm font-medium text-brand-black">
                      {Icon && <Icon className="size-4" />}
                      {label}
                    </span>
                    <Radio on={on} />
                  </div>
                )}
              </button>
            );
          },
        )}
      </div>
      <FieldError message={error} />
    </div>
  );
}
