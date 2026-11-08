"use client";

import { useState } from "react";
import { AlertTriangle, CircleCheck, Loader2, Ruler } from "lucide-react";
import type { UnitCandidate, UnitName } from "@vectroq/shared-types";
import type { PublicUnitState } from "@/lib/cad-unit";
import { Button } from "@/components/ui/button";

const LABEL: Record<UnitName, string> = {
  inch: "Inches",
  foot: "Feet",
  millimetre: "Millimetres",
  centimetre: "Centimetres",
  metre: "Metres",
  yard: "Yards",
  decimetre: "Decimetres",
  "survey-foot": "US survey feet",
  unknown: "Unknown",
};

const ft = (n: number) =>
  n >= 100
    ? Math.round(n).toLocaleString("en-US")
    : String(Math.round(n * 10) / 10);

function describeSource(s: PublicUnitState): string {
  const { source } = s.unit;
  if (source === "user") return "confirmed by you";
  if (source === "header") return "read from the drawing";
  return "suggested, not confirmed";
}

interface Props {
  /** null = this drawing has no stored unit decision (legacy row). */
  state: PublicUnitState | null;
  busy: boolean;
  /** Edits that a unit change would discard (saved or still unsaved). */
  hasManualEdits: boolean;
  /** Set when the server or the panel needs an explicit "replace my edits" decision. */
  pendingReplace: UnitName | null;
  onConfirm: (unit: UnitName, replaceEdits: boolean) => void;
  onCancelReplace: () => void;
}

/**
 * Shows the drawing unit, why it needs confirming, the candidate readings with
 * their size in feet, and lets the estimator pick (overriding the suggestion).
 * The server is the authority: this component never marks anything confirmed.
 */
export function UnitConfirmation({
  state,
  busy,
  hasManualEdits,
  pendingReplace,
  onConfirm,
  onCancelReplace,
}: Props) {
  const [changing, setChanging] = useState(false);
  const suggested = state?.unit.unit && state.unit.unit !== "unknown" ? state.unit.unit : null;
  const [choice, setChoice] = useState<UnitName | null>(null);
  const selected = choice ?? suggested;

  if (!state) {
    return (
      <div
        role="status"
        data-testid="unit-legacy"
        className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      >
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <p>
          <span className="font-semibold">Drawing units not verified.</span> This
          drawing was saved before unit checking existed. Any BOQ already saved
          is kept, but a new BOQ cannot be calculated until you re-upload the
          DXF and confirm its unit.
        </p>
      </div>
    );
  }

  const needs = state.needsConfirmation;
  const showPicker = needs || changing;
  const warnings = state.warnings.filter((w) => w.severity !== "info");
  const candidates: UnitCandidate[] = state.unit.candidates ?? [];
  const extra =
    suggested && !candidates.some((c) => c.unit === suggested) ? suggested : null;

  if (!showPicker) {
    return (
      <div
        data-testid="unit-confirmed"
        className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900"
      >
        <CircleCheck className="size-4 shrink-0" />
        <span>
          <span className="font-semibold">Drawing unit: {LABEL[state.unit.unit ?? "unknown"]}</span>{" "}
          ({describeSource(state)})
        </span>
        <button
          type="button"
          onClick={() => setChanging(true)}
          disabled={busy}
          className="ml-auto cursor-pointer text-xs font-semibold underline disabled:cursor-not-allowed"
        >
          Change unit
        </button>
      </div>
    );
  }

  return (
    <section
      aria-label="Drawing unit"
      data-testid="unit-picker"
      className="space-y-3 rounded-xl border border-amber-300 bg-amber-50/70 p-4"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-800">
          <Ruler className="size-4" />
        </span>
        <div className="text-sm text-amber-950">
          <p className="font-semibold">
            {needs ? "Confirm the drawing unit" : "Change the drawing unit"}
          </p>
          <p className="mt-0.5 text-amber-900/90">
            {needs
              ? "The drawing's unit could not be established with certainty. The numbers below are a guess from the drawing's size, not proof. A BOQ cannot be calculated until you confirm the unit."
              : "Pick a different unit to re-read the original drawing."}
          </p>
        </div>
      </div>

      {needs && warnings.length > 0 && (
        <ul className="space-y-1 text-xs text-amber-900" aria-label="Unit warnings">
          {warnings.map((w, i) => (
            <li key={`${w.code}-${i}`} className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>{w.message}</span>
            </li>
          ))}
        </ul>
      )}

      <fieldset disabled={busy || pendingReplace !== null} className="space-y-1.5">
        <legend className="sr-only">Drawing unit</legend>
        {candidates.map((c) => (
          <label
            key={c.unit}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm ${
              selected === c.unit ? "border-brand bg-white" : "border-stone-200 bg-white/60"
            }`}
          >
            <input
              type="radio"
              name="drawing-unit"
              value={c.unit}
              checked={selected === c.unit}
              onChange={() => setChoice(c.unit)}
              className="mt-1"
            />
            <span className="min-w-0 flex-1">
              <span className="font-semibold text-brand-black">{LABEL[c.unit]}</span>
              {suggested === c.unit && (
                <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">
                  Suggested
                </span>
              )}
              <span className="mt-0.5 block text-xs text-stone-600">
                Drawing would be {ft(c.widthFt)} × {ft(c.heightFt)} ft ·{" "}
                {c.plausible ? "plausible building size" : "unlikely building size"}
              </span>
            </span>
          </label>
        ))}
        {extra && (
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-stone-200 bg-white/60 px-3 py-2 text-sm">
            <input
              type="radio"
              name="drawing-unit"
              value={extra}
              checked={selected === extra}
              onChange={() => setChoice(extra)}
            />
            <span className="font-semibold text-brand-black">{LABEL[extra]}</span>
            <span className="text-xs text-stone-600">(from the drawing's header)</span>
          </label>
        )}
      </fieldset>

      {pendingReplace ? (
        <div role="alertdialog" aria-label="Replace manual corrections?" className="space-y-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          <p>
            <span className="font-semibold">This will discard your corrections.</span>{" "}
            Applying {LABEL[pendingReplace]} re-reads the original drawing, so
            any manual changes to rooms, walls or openings (saved or unsaved)
            will be replaced.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => onConfirm(pendingReplace, true)}
              disabled={busy}
              className="h-9 cursor-pointer bg-red-600 px-3 text-white hover:bg-red-700"
            >
              Replace my corrections and apply {LABEL[pendingReplace]}
            </Button>
            <Button type="button" variant="outline" onClick={onCancelReplace} disabled={busy} className="h-9 cursor-pointer px-3">
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => selected && onConfirm(selected, false)}
            disabled={busy || !selected}
            className="h-10 cursor-pointer gap-2 bg-brand px-4 text-white hover:bg-brand-dark disabled:cursor-not-allowed"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Confirm unit
          </Button>
          {!needs && (
            <button type="button" onClick={() => setChanging(false)} className="cursor-pointer text-xs font-semibold underline">
              Cancel
            </button>
          )}
          {hasManualEdits && (
            <span className="text-xs text-amber-900">
              You have manual corrections: you'll be asked before they are replaced.
            </span>
          )}
        </div>
      )}
    </section>
  );
}
