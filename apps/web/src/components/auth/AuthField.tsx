import type { ComponentProps, ReactNode, Ref } from "react";

interface Props extends Omit<ComponentProps<"input">, "className" | "id"> {
  id: string;
  label: string;
  icon: ReactNode;
  error?: string;
  hint?: ReactNode;
  /** Element shown inside the right edge (e.g. a show/hide button). */
  right?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

export function AuthField({
  id,
  label,
  icon,
  error,
  hint,
  right,
  ref,
  ...input
}: Props) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div>
      <label
        htmlFor={id}
        className="text-sm font-semibold text-brand-black dark:text-slate-200"
      >
        {label}
      </label>
      <div className="relative mt-2">
        <span
          className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 [&_svg]:size-4 ${
            error ? "text-red-400" : "text-stone-400 dark:text-slate-500"
          }`}
        >
          {icon}
        </span>
        <input
          id={id}
          ref={ref}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={`h-12 w-full rounded-xl border bg-white pl-11 ${
            right ? "pr-12" : "pr-4"
          } text-base text-brand-black shadow-sm outline-none transition placeholder:text-stone-400 focus:ring-4 sm:text-[15px] dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500 ${
            error
              ? "border-red-400 focus:border-red-500 focus:ring-red-100 dark:border-red-400/60 dark:focus:ring-red-500/20"
              : "border-stone-200 hover:border-stone-300 focus:border-brand focus:ring-brand/15 dark:border-white/15 dark:hover:border-white/30 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
          }`}
          {...input}
        />
        {right && (
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
            {right}
          </div>
        )}
      </div>
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      ) : hint ? (
        <p
          id={`${id}-hint`}
          className="mt-1.5 text-xs font-medium text-amber-600 dark:text-amber-400"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
