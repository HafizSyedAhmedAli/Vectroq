"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  CITY_NAMES,
  type Category,
  type EngagementModel,
} from "@tmcc/shared-types";
import {
  ArrowRight,
  FileText,
  LayoutGrid,
  MapPin,
  Plus,
  StickyNote,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

interface ConvertLeadFormProps {
  leadId: string;
  defaultCity: string;
  defaultModel: number;
  defaultCategory: string;
}

// SRS §3 steps 3-5: by the time office is looking at this form, they've
// already met the client and finalized the design brief — city/model/
// category default to whatever the client picked on intake (FR-3), but
// office can adjust them here if the meeting changed anything, and can
// record meeting notes (FR-6) before creating the Project (FR-5).
export function ConvertLeadForm({
  leadId,
  defaultCity,
  defaultModel,
  defaultCategory,
}: ConvertLeadFormProps) {
  const router = useRouter();
  const [city, setCity] = useState(defaultCity);
  const [model, setModel] = useState(defaultModel);
  const [category, setCategory] = useState(defaultCategory);
  const [meetingNotes, setMeetingNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          city,
          model,
          category,
          meetingNotes: meetingNotes.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok)
        throw new Error(body.error ?? "Could not create the project.");
      router.push(`/office/${body.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create the project.",
      );
      setIsSubmitting(false);
    }
  }

  const labelCls =
    "flex items-center gap-2 text-sm font-semibold text-stone-600";
  const selectCls =
    "mt-2 w-full cursor-pointer [&_select]:h-12 [&_select]:rounded-xl [&_select]:border-stone-200 [&_select]:bg-white [&_select]:px-4 [&_select]:text-[15px] [&_select]:text-brand-black [&_select]:shadow-sm [&_select:hover]:border-stone-300 [&_select:focus-visible]:border-brand [&_select:focus-visible]:ring-brand/20 [&_svg]:right-4";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Label htmlFor={`city-${leadId}`} className={labelCls}>
            <MapPin className="size-4 text-brand" />
            City
          </Label>
          <NativeSelect
            id={`city-${leadId}`}
            className={selectCls}
            value={city}
            onChange={(e) => setCity(e.target.value)}
          >
            {CITY_NAMES.map((c) => (
              <NativeSelectOption key={c} value={c}>
                {c}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor={`model-${leadId}`} className={labelCls}>
            <FileText className="size-4 text-brand" />
            Model
          </Label>
          <NativeSelect
            id={`model-${leadId}`}
            className={selectCls}
            value={model}
            onChange={(e) =>
              setModel(Number(e.target.value) as EngagementModel)
            }
          >
            <NativeSelectOption value={1}>1</NativeSelectOption>
            <NativeSelectOption value={2}>2</NativeSelectOption>
            <NativeSelectOption value={3}>3</NativeSelectOption>
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor={`category-${leadId}`} className={labelCls}>
            <LayoutGrid className="size-4 text-brand" />
            Category
          </Label>
          <NativeSelect
            id={`category-${leadId}`}
            className={selectCls}
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
          >
            <NativeSelectOption value="A">A</NativeSelectOption>
            <NativeSelectOption value="B">B</NativeSelectOption>
            <NativeSelectOption value="C">C</NativeSelectOption>
          </NativeSelect>
        </div>
      </div>

      <div>
        <Label htmlFor={`notes-${leadId}`} className={labelCls}>
          <StickyNote className="size-4 text-brand" />
          Meeting notes (optional)
        </Label>
        <textarea
          id={`notes-${leadId}`}
          rows={3}
          className="mt-2 w-full resize-y rounded-xl border border-stone-200 bg-white px-4 py-3 text-[15px] text-brand-black shadow-sm outline-none transition placeholder:text-stone-400 hover:border-stone-300 focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20"
          placeholder="Design brief, plot details, anything from the meeting worth keeping on the project…"
          value={meetingNotes}
          onChange={(e) => setMeetingNotes(e.target.value)}
        />
      </div>

      {error && (
        <p
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600"
          role="alert"
        >
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={isSubmitting}
        className="h-12 cursor-pointer gap-3 rounded-xl bg-brand px-4 text-[15px] font-semibold text-white shadow-md shadow-brand/30 hover:bg-brand-dark disabled:cursor-not-allowed"
      >
        <span className="flex size-6 items-center justify-center rounded-full bg-white text-brand">
          <Plus className="size-4" />
        </span>
        {isSubmitting ? "Creating…" : "Create project"}
        <ArrowRight className="size-4" />
      </Button>
    </form>
  );
}
