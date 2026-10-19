"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Loader2, RotateCcw, Save } from "lucide-react";
import {
  CATEGORY_KEYS,
  DEFAULT_EXCLUSIONS,
  MODEL_KEYS,
  buildAssumptions,
  type Category,
  type EngagementModel,
  type OrgRules,
} from "@vectroq/shared-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const card =
  "rounded-2xl border border-stone-200/70 bg-white p-5 shadow-[0_10px_40px_-12px_rgba(15,23,42,0.10)] sm:p-7";

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className={card}>
      <h2 className="text-lg font-bold text-brand-black">{title}</h2>
      <p className="mt-1 text-sm text-stone-500">{hint}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

// Uncontrolled on purpose so "1." and "" can be typed; remounted via `key` on reset.
// An empty box sends NaN -> null, which the server rejects with a clear message.
function NumField({
  id,
  label,
  value,
  onChange,
  suffix,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      <div className="relative mt-1.5">
        <Input
          id={id}
          type="number"
          step="any"
          min={0}
          defaultValue={value}
          className="h-11 pr-16"
          onChange={(e) => onChange(e.currentTarget.valueAsNumber)}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  max,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      <Input
        id={id}
        className="mt-1.5 h-11"
        maxLength={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

const LABOUR: [keyof OrgRules["labour"], string, string][] = [
  ["masonry", "Brick masonry", "Rs / sq ft"],
  ["plaster", "Plaster (both faces)", "Rs / sq ft"],
  ["shuttering", "Roof shuttering", "Rs / sq ft"],
  ["steelFixing", "Steel cutting & fixing", "Rs / ton"],
  ["sanitary", "Sanitary fixtures", "Rs / bathroom"],
  ["tileFixing", "Tile fixing", "Rs / sq ft"],
  ["marbleFixing", "Marble fixing", "Rs / sq ft"],
  ["woodwork", "Doors & windows", "Rs / sq ft"],
];
const CONSTRUCTION: [keyof OrgRules["construction"], string][] = [
  ["wallHeightFt", "Wall height"],
  ["exteriorWallThicknessFt", "Exterior wall thickness"],
  ["partitionThicknessFt", "Interior partition thickness"],
  ["doorHeightFt", "Door height"],
  ["windowHeightFt", "Window height"],
];
const MATERIALS: [keyof OrgRules["materials"], string, string][] = [
  ["bricksPerSqftFaceAtReference", "Bricks per sq ft of wall face", "bricks"],
  ["referenceThicknessFt", "Wall thickness that brick count applies to", "ft"],
  ["cementBagsPer1000Bricks", "Cement per 1,000 bricks", "bags"],
  ["sandCftPer1000Bricks", "Sand per 1,000 bricks", "cft"],
  ["plasterCementBagsPerSqft", "Plaster cement", "bags / sq ft"],
  ["plasterSandCftPerSqft", "Plaster sand", "cft / sq ft"],
  ["steelKgPerSqft", "Reinforcement steel", "kg / sq ft"],
];

const toLines = (t: string) => {
  const lines = t
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.length ? lines : null; // blank = use the automatic text
};

export function RulesForm({ initial }: { initial: OrgRules }) {
  const router = useRouter();
  const [f, setF] = useState<OrgRules>(initial);
  const [aText, setAText] = useState(
    (initial.notes.assumptions ?? []).join("\n"),
  );
  const [eText, setEText] = useState(
    (initial.notes.exclusions ?? []).join("\n"),
  );
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const touch = () => setSaved(false);
  const setModel = (
    m: EngagementModel,
    patch: Partial<OrgRules["models"][1]>,
  ) => {
    touch();
    setF((p) => ({
      ...p,
      models: { ...p.models, [m]: { ...p.models[m], ...patch } },
    }));
  };
  const setCat = (c: Category, patch: Partial<OrgRules["categories"]["A"]>) => {
    touch();
    setF((p) => ({
      ...p,
      categories: { ...p.categories, [c]: { ...p.categories[c], ...patch } },
    }));
  };
  const setNum = <S extends "labour" | "construction" | "materials">(
    s: S,
    key: keyof OrgRules[S],
    value: number,
  ) => {
    touch();
    setF((p) => ({ ...p, [s]: { ...p[s], [key]: value } }));
  };

  async function send(body: unknown) {
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/org/rules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save.");
      return null;
    }
    return data.rules as OrgRules;
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const rules = await send({
      ...f,
      notes: { assumptions: toLines(aText), exclusions: toLines(eText) },
    });
    if (rules) {
      setSaved(true);
      router.refresh();
    }
  }

  async function reset() {
    if (busy || !confirm("Reset ALL business rules to the defaults?")) return;
    const rules = await send({ reset: true });
    if (rules) {
      setF(rules);
      setAText("");
      setEText("");
      setVersion((v) => v + 1); // remount the number inputs
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <form onSubmit={save} className="space-y-6" key={version}>
      <Section
        title="Service types & tax"
        hint="The three options shown on your intake form. Tax is added to the BOQ total for that type."
      >
        <div className="space-y-5">
          {MODEL_KEYS.map((m) => (
            <div
              key={m}
              className="grid gap-4 rounded-xl border border-stone-200 p-4 sm:grid-cols-[1fr_120px]"
            >
              <TextField
                id={`m${m}-label`}
                label={`Service type ${m} name`}
                max={60}
                value={f.models[m].label}
                onChange={(v) => setModel(m, { label: v })}
              />
              <NumField
                id={`m${m}-tax`}
                label="Tax"
                suffix="%"
                value={f.models[m].taxPercent}
                onChange={(n) => setModel(m, { taxPercent: n })}
              />
              <div className="sm:col-span-2">
                <TextField
                  id={`m${m}-desc`}
                  label="Description (optional)"
                  max={200}
                  value={f.models[m].description}
                  onChange={(v) => setModel(m, { description: v })}
                />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Material categories"
        hint="What A, B and C mean for your company: their names, the false-ceiling rate, and whether living areas get marble or tiles."
      >
        <div className="space-y-4">
          {CATEGORY_KEYS.map((c) => (
            <div
              key={c}
              className="grid items-end gap-4 rounded-xl border border-stone-200 p-4 sm:grid-cols-[1fr_160px_auto]"
            >
              <TextField
                id={`c${c}-label`}
                label={`Category ${c} name`}
                max={30}
                value={f.categories[c].label}
                onChange={(v) => setCat(c, { label: v })}
              />
              <NumField
                id={`c${c}-fc`}
                label="False ceiling"
                suffix="Rs / sq ft"
                value={f.categories[c].falseCeilingRate}
                onChange={(n) => setCat(c, { falseCeilingRate: n })}
              />
              <label className="flex h-11 cursor-pointer items-center gap-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  className="size-4 accent-brand"
                  checked={f.categories[c].marbleInLiving}
                  onChange={(e) =>
                    setCat(c, { marbleInLiving: e.target.checked })
                  }
                />
                Marble in living areas
              </label>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Labour rates"
        hint="Applied to every city. They always override labour rows in an imported rate schedule."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LABOUR.map(([k, label, suffix]) => (
            <NumField
              key={k}
              id={`l-${k}`}
              label={label}
              suffix={suffix}
              value={f.labour[k]}
              onChange={(n) => setNum("labour", k, n)}
            />
          ))}
        </div>
      </Section>

      <Section
        title="Drawing assumptions"
        hint="A plan view has no heights, so these are applied to every drawing you upload."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CONSTRUCTION.map(([k, label]) => (
            <NumField
              key={k}
              id={`k-${k}`}
              label={label}
              suffix="ft"
              value={f.construction[k]}
              onChange={(n) => setNum("construction", k, n)}
            />
          ))}
        </div>
        <p className="mt-3 text-xs text-stone-400">
          Applies to drawings uploaded from now on. Re-upload a drawing to
          re-read it with new values.
        </p>
      </Section>

      <Section
        title="Material quantities"
        hint="Rules of thumb used to turn areas into bricks, cement, sand and steel."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MATERIALS.map(([k, label, suffix]) => (
            <NumField
              key={k}
              id={`mat-${k}`}
              label={label}
              suffix={suffix}
              value={f.materials[k]}
              onChange={(n) => setNum("materials", k, n)}
            />
          ))}
        </div>
      </Section>

      <Section
        title="BOQ notes"
        hint="Printed on every BOQ, client page and PDF. One line per bullet. Leave blank to use the automatic text."
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="n-assume" className="text-sm font-semibold">
                Basis of estimate
              </Label>
              <button
                type="button"
                className="cursor-pointer text-xs font-semibold text-brand underline"
                onClick={() => {
                  setAText(buildAssumptions(f).join("\n"));
                  touch();
                }}
              >
                Fill with automatic text
              </button>
            </div>
            <textarea
              id="n-assume"
              rows={9}
              value={aText}
              onChange={(e) => {
                setAText(e.target.value);
                touch();
              }}
              placeholder="Automatic: generated from the numbers above"
              className="mt-1.5 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="n-excl" className="text-sm font-semibold">
                Not included
              </Label>
              <button
                type="button"
                className="cursor-pointer text-xs font-semibold text-brand underline"
                onClick={() => {
                  setEText(DEFAULT_EXCLUSIONS.join("\n"));
                  touch();
                }}
              >
                Fill with default text
              </button>
            </div>
            <textarea
              id="n-excl"
              rows={9}
              value={eText}
              onChange={(e) => {
                setEText(e.target.value);
                touch();
              }}
              placeholder="Default list is used when blank"
              className="mt-1.5 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
            />
          </div>
        </div>
        <p className="mt-3 text-xs text-stone-400">
          The PDF uses a standard Latin font, so keep notes in English
          characters.
        </p>
      </Section>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {saved && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
        >
          <CircleCheck className="size-4" /> Business rules saved.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-white shadow-md shadow-brand/25 hover:bg-brand-dark disabled:cursor-wait disabled:opacity-70"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {busy ? "Saving…" : "Save rules"}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={busy}
          className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-stone-300 bg-white px-5 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-60"
        >
          <RotateCcw className="size-4" /> Reset to defaults
        </button>
      </div>
    </form>
  );
}
