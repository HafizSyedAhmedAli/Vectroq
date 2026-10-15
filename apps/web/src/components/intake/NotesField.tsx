// apps/web/src/components/intake/NotesField.tsx
import { Label } from "@/components/ui/label";
import { FieldError } from "./fields";

interface NotesFieldProps {
  id: string;
  label: string;
  value: string;
  maxLength: number;
  error?: string;
  onChange: (value: string) => void;
}

export function NotesField({
  id,
  label,
  value,
  maxLength,
  error,
  onChange,
}: NotesFieldProps) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative mt-1.5">
        <textarea
          id={id}
          rows={5}
          maxLength={maxLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Tell us about any specific requirements, preferences or notes for your project…"
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 pb-6 text-sm outline-none placeholder:text-muted-foreground resize-none"
        />
        <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-stone-400">
          {value.length}/{maxLength}
        </span>
      </div>
      <FieldError message={error} />
    </div>
  );
}
