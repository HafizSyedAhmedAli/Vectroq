"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  CircleCheck,
  FileText,
  Hammer,
  Info,
  Layers,
  Loader2,
  Package,
  Receipt,
  RotateCcw,
  Ruler,
  Save,
  type LucideIcon,
} from "lucide-react";
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
import { ConfirmDialog } from "@/components/ConfirmDialog";

const card =
  "rounded-2xl border border-stone-200/70 bg-white p-5 shadow-[0_10px_40px_-12px_rgba(15,23,42,0.10)] sm:p-6";
const group = "rounded-xl border border-stone-200 bg-white p-4";
const tinted =
  "rounded-xl border border-[color-mix(in_srgb,var(--color-brand)_18%,var(--color-white))] bg-gradient-to-r from-[color-mix(in_srgb,var(--color-brand)_6%,var(--color-white))] to-white p-4";
const inputCls =
  "h-11 rounded-lg border-stone-200! bg-white! text-sm text-brand-black shadow-none hover:border-stone-300! focus-visible:border-brand! focus-visible:ring-brand/20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
const labelCls = "text-xs font-semibold text-brand-black";
const areaCls =
  "w-full resize-none rounded-lg border border-stone-200 bg-white px-3 pb-8 pt-2.5 text-sm text-brand-black outline-none placeholder:text-stone-400 hover:border-stone-300 focus:border-brand focus:ring-4 focus:ring-brand/15";

function Section({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className={card}>
      <div className="flex items-center gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
          <Icon className="size-5" />
        </span>
        <div>
          <h2 className="text-base font-bold text-brand-black">{title}</h2>
          <p className="text-xs text-stone-500">{hint}</p>
        </div>
      </div>
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
      <Label htmlFor={id} className={labelCls}>
        {label}
      </Label>
      <div className="relative mt-1.5">
        <Input
          id={id}
          type="number"
          step="any"
          min={0}
          defaultValue={value}
          className={`${inputCls} ${suffix ? "pr-24" : ""}`}
          onChange={(e) => onChange(e.currentTarget.valueAsNumber)}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] text-stone-400">
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
      <Label htmlFor={id} className={labelCls}>
        {label}
      </Label>
      <Input
        id={id}
        className={`mt-1.5 ${inputCls}`}
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
const lineCount = (t: string) => t.split("\n").filter((l) => l.trim()).length;

function NotesBox({
  id,
  label,
  actionLabel,
  onAction,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  actionLabel: string;
  onAction: () => void;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className={labelCls}>
          {label}
        </Label>
        <button
          type="button"
          onClick={onAction}
          className="cursor-pointer text-xs font-semibold text-brand underline-offset-2 hover:underline"
        >
          {actionLabel}
        </button>
      </div>
      <div className="relative mt-1.5">
        <textarea
          id={id}
          rows={7}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={areaCls}
        />
        <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-stone-400">
          {lineCount(value)}/15 lines
        </span>
      </div>
    </div>
  );
}

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
  const [confirmReset, setConfirmReset] = useState(false);

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
    if (busy) return;
    const rules = await send({ reset: true });
    setConfirmReset(false);
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
    <form onSubmit={save} className="space-y-5" key={version}>
      <Section
        icon={Receipt}
        title="Service types & tax"
        hint="The three options shown on your intake form. Tax is added to the BOQ total for that type."
      >
        <div className="space-y-3">
          {MODEL_KEYS.map((m) => (
            <div key={m} className={`${tinted} flex gap-4`}>
              <span className="mt-7 grid size-8 shrink-0 place-items-center rounded-full bg-brand/10 text-sm font-bold text-brand">
                {m}
              </span>
              <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[1fr_180px]">
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
            </div>
          ))}
        </div>
      </Section>

      <Section
        icon={Layers}
        title="Material categories"
        hint="What A, B and C mean for your company: their names, the false-ceiling rate, and whether living areas get marble or tiles."
      >
        <div className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
          {CATEGORY_KEYS.map((c) => (
            <div
              key={c}
              className="grid items-end gap-4 p-4 sm:grid-cols-[1fr_1fr_auto]"
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
              <label className="flex h-11 cursor-pointer items-center gap-2 text-xs text-stone-600">
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
        icon={Hammer}
        title="Labour rates"
        hint="Applied to every city. They always override labour rows in an imported rate schedule."
      >
        <div className={`${group} grid gap-4 sm:grid-cols-2 lg:grid-cols-4`}>
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
        icon={Ruler}
        title="Drawing assumptions"
        hint="A plan view has no heights, so these are applied to every drawing you upload."
      >
        <div className={group}>
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
          <p className="mt-4 flex items-center gap-2 text-[11px] text-stone-400">
            <Info className="size-3.5 shrink-0 text-brand" />
            Applies to drawings uploaded from now on. Re-upload a drawing to
            re-read it with new values.
          </p>
        </div>
      </Section>

      <Section
        icon={Package}
        title="Material quantities"
        hint="Rules of thumb used to turn areas into bricks, cement, sand and steel."
      >
        <div className={`${group} grid gap-4 sm:grid-cols-2 lg:grid-cols-3`}>
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
        icon={FileText}
        title="BOQ notes"
        hint="Printed on every BOQ, client page and PDF. One line per bullet. Leave blank to use the automatic text."
      >
        <div className={`${group} grid gap-5 lg:grid-cols-2`}>
          <NotesBox
            id="n-assume"
            label="Basis of estimate"
            actionLabel="Fill with automatic text"
            onAction={() => {
              setAText(buildAssumptions(f).join("\n"));
              touch();
            }}
            value={aText}
            onChange={(v) => {
              setAText(v);
              touch();
            }}
            placeholder="Automatic: generated from the numbers above"
          />
          <NotesBox
            id="n-excl"
            label="Not included"
            actionLabel="Fill with default text"
            onAction={() => {
              setEText(DEFAULT_EXCLUSIONS.join("\n"));
              touch();
            }}
            value={eText}
            onChange={(v) => {
              setEText(v);
              touch();
            }}
            placeholder="Default list is used when blank"
          />
        </div>
        <p className="mt-3 text-xs text-stone-400">
          The PDF uses a standard Latin font, so keep notes in English
          characters.
        </p>
      </Section>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 z-20 -mx-4 border-t border-stone-200 bg-white/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-white shadow-md shadow-brand/25 hover:bg-brand-dark disabled:cursor-wait disabled:opacity-70"
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
            onClick={() => setConfirmReset(true)}
            disabled={busy}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-stone-300 bg-white px-5 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-60"
          >
            <RotateCcw className="size-4" /> Reset to defaults
          </button>

          {error && (
            <p role="alert" className="text-sm font-medium text-red-600">
              {error}
            </p>
          )}
          {saved && (
            <p
              role="status"
              className="flex items-center gap-1.5 text-sm font-medium text-green-700"
            >
              <CircleCheck className="size-4" /> Business rules saved.
            </p>
          )}
        </div>
      </div>
      {confirmReset && (
        <ConfirmDialog
          title="Reset all business rules?"
          message="Service types, tax, labour rates, drawing assumptions, material quantities and BOQ notes will go back to the defaults. Saved BOQs keep their prices."
          confirmLabel="Reset to defaults"
          busyLabel="Resetting…"
          busy={busy}
          onConfirm={reset}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </form>
  );
}
