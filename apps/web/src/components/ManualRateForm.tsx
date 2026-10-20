"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Loader2, Plus } from "lucide-react";
import { CITY_NAMES } from "@vectroq/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

const ITEMS = [
  {
    type: "brick",
    label: "Bricks",
    unit: "1000nos",
    suffix: "Rs / 1,000",
    required: true,
  },
  {
    type: "cement",
    label: "Cement (50 kg bag)",
    unit: "bag",
    suffix: "Rs / bag",
    required: true,
  },
  {
    type: "sand",
    label: "Sand",
    unit: "cft",
    suffix: "Rs / cft",
    required: true,
  },
  {
    type: "steelMaterial",
    label: "Steel bars",
    unit: "ton",
    suffix: "Rs / ton",
    required: true,
  },
  {
    type: "rccRoof",
    label: "RCC roof (optional)",
    unit: "sqft",
    suffix: "Rs / sq ft",
    required: false,
  },
  {
    type: "paint",
    label: "Paint (optional)",
    unit: "sqft",
    suffix: "Rs / sq ft",
    required: false,
  },
  {
    type: "foundation",
    label: "Foundation (optional)",
    unit: "sqft",
    suffix: "Rs / sq ft",
    required: false,
  },
  {
    type: "electrical",
    label: "Electrical (optional)",
    unit: "sqft",
    suffix: "Rs / sq ft",
    required: false,
  },
] as const;

export function ManualRateForm({
  categoryLabels,
}: {
  categoryLabels?: Record<string, string>;
}) {
  const router = useRouter();
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("B");
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setDone(false);
    if (!city) return setError("Choose a city.");

    const items = [];
    for (const it of ITEMS) {
      const raw = (values[it.type] ?? "").trim();
      if (!raw) {
        if (it.required) return setError(`Enter a rate for ${it.label}.`);
        continue;
      }
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0)
        return setError(`${it.label} must be a positive number.`);
      items.push({ itemType: it.type, unit: it.unit, unitRate: n });
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/rate-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, category, items }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not save the draft.");
      setValues({});
      setDone(true);
      router.refresh(); // the new draft appears under "Drafts awaiting review"
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-stone-200/70 bg-white p-5 shadow-[0_10px_40px_-12px_rgba(35,31,30,0.12)] sm:p-6">
      <h2 className="text-lg font-bold text-brand-black">
        Override rates manually
      </h2>
      <p className="text-sm text-stone-500">
        Enter your own material rates for one city. Once approved, they replace
        the default rates for that city and category.
      </p>

      <form onSubmit={submit} noValidate className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="mr-city" className="text-[13px] font-semibold">
              City
            </Label>
            <NativeSelect
              id="mr-city"
              className="mt-1.5 w-full cursor-pointer"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            >
              <NativeSelectOption value="">Select a city</NativeSelectOption>
              {CITY_NAMES.map((c) => (
                <NativeSelectOption key={c} value={c}>
                  {c}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label htmlFor="mr-cat" className="text-[13px] font-semibold">
              Category
            </Label>
            <NativeSelect
              id="mr-cat"
              className="mt-1.5 w-full cursor-pointer"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {["A", "B", "C"].map((c) => (
                <NativeSelectOption key={c} value={c}>
                  {c} {categoryLabels?.[c] ? `(${categoryLabels[c]})` : ""}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map((it) => (
            <div key={it.type}>
              <Label
                htmlFor={`mr-${it.type}`}
                className="text-xs font-semibold"
              >
                {it.label}
              </Label>
              <div className="relative mt-1.5">
                <Input
                  id={`mr-${it.type}`}
                  type="number"
                  min={0}
                  step="any"
                  className="pr-24"
                  value={values[it.type] ?? ""}
                  onChange={(e) =>
                    setValues((p) => ({ ...p, [it.type]: e.target.value }))
                  }
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] text-stone-400">
                  {it.suffix}
                </span>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        {done && (
          <p
            role="status"
            className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
          >
            <CircleCheck className="size-4" /> Draft saved. Approve it under
            “Drafts awaiting review”.
          </p>
        )}

        <Button
          type="submit"
          disabled={busy}
          className="h-11 cursor-pointer gap-2 rounded-xl bg-brand px-6 text-white hover:bg-brand-dark"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          {busy ? "Saving…" : "Save as draft"}
        </Button>
      </form>
    </section>
  );
}
