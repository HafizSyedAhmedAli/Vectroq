// apps/web/src/components/intake/fields.tsx
import type { ComponentProps, ReactNode } from "react";
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

export function Radio({ on }: { on: boolean }) {
  return (
    <span
      className={`size-4 shrink-0 rounded-full border-2 grid place-items-center ${
        on ? "border-brand" : "border-stone-300"
      }`}
    >
      {on && <span className="size-2 rounded-full bg-brand" />}
    </span>
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
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 z-10">
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
        {label} {required && <RequiredMark />}
      </Label>
      <IconInput icon={icon}>
        <Input
          id={id}
          className="pl-9 h-10"
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
        {label} {required && <RequiredMark />}
      </Label>
      <IconInput icon={icon}>
        <NativeSelect
          id={id}
          className="w-full cursor-pointer [&_select]:h-10 [&_select]:pl-9"
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
