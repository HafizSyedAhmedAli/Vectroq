// apps/web/src/components/intake/fields.tsx
import type { ComponentProps, ReactNode } from "react";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

export const errorClass = "text-xs text-red-600 mt-1";

export function RequiredMark() {
  return <span className="text-brand">*</span>;
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className={errorClass} role="alert">
      {message}
    </p>
  );
}

/** Section title with the accent bar from the design. */
export function StepHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="border-l-4 border-brand pl-3 text-lg font-bold text-brand-black">
      {children}
    </h2>
  );
}

/** Filled check when chosen, empty ring when not. */
export function Radio({ on }: { on: boolean }) {
  return on ? (
    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand text-white">
      <Check className="size-3" strokeWidth={3} />
    </span>
  ) : (
    <span className="size-5 shrink-0 rounded-full border-2 border-stone-300" />
  );
}

export function IconInput({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="relative mt-1.5">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 z-10">
        {icon}
      </span>
      {children}
    </div>
  );
}

interface BaseFieldProps {
  id: string;
  label: string;
  icon: ReactNode;
  required?: boolean;
  error?: string;
}

export function TextField({
  id,
  label,
  icon,
  required,
  error,
  ...inputProps
}: BaseFieldProps & Omit<ComponentProps<"input">, "id" | "className">) {
  return (
    <div>
      <Label htmlFor={id}>
        <span>
          {label} {required && <RequiredMark />}
        </span>
      </Label>
      <IconInput icon={icon}>
        <Input
          id={id}
          className="h-11! rounded-xl! border-stone-200! pl-10 shadow-sm hover:border-stone-300!"
          aria-invalid={!!error}
          {...inputProps}
        />
      </IconInput>
      <FieldError message={error} />
    </div>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export function SelectField({
  id,
  label,
  icon,
  required,
  error,
  placeholder,
  options,
  value,
  onChange,
}: BaseFieldProps & {
  placeholder: string;
  options: readonly SelectOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>
        <span>
          {label} {required && <RequiredMark />}
        </span>
      </Label>
      <IconInput icon={icon}>
        <NativeSelect
          id={id}
          className="w-full cursor-pointer [&_select]:h-11 [&_select]:rounded-xl [&_select]:border-stone-200 [&_select]:pl-10 [&_select]:shadow-sm [&_select:hover]:border-stone-300"
          value={value}
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value)}
        >
          <NativeSelectOption value="">{placeholder}</NativeSelectOption>
          {options.map((o) => (
            <NativeSelectOption key={o.value} value={o.value}>
              {o.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </IconInput>
      <FieldError message={error} />
    </div>
  );
}
