// apps/web/src/components/intake/StepRequirements.tsx
import {
  BedDouble,
  Calendar,
  Layers,
  Ruler,
  Square,
  Wallet,
} from "lucide-react";
import {
  BEDROOM_OPTIONS,
  BUDGET_RANGES,
  FLOOR_OPTIONS,
  MAX_NOTES_LENGTH,
  TIMELINES,
} from "@tmcc/lead-intake";
import { FileDropzone } from "./FileDropzone";
import { SelectField, TextField } from "./fields";
import { NotesField } from "./NotesField";
import { OptionCards } from "./OptionCards";
import { CATEGORY_OPTIONS, HOUSE_TYPE_OPTIONS } from "./option-config";
import type { StepProps } from "./types";

interface StepRequirementsProps extends StepProps {
  planFile: File | null;
  planFileError: string | null;
  onPlanFileChange: (file: File | null) => void;
}

const asOptions = (values: readonly string[]) =>
  values.map((v) => ({ value: v, label: v }));

const floorOptions = FLOOR_OPTIONS.map((n) => ({
  value: String(n),
  label: n === 1 ? "1 floor" : `${n} floors`,
}));
const bedroomOptions = BEDROOM_OPTIONS.map((n) => ({
  value: String(n),
  label: n === 1 ? "1 bedroom" : `${n} bedrooms`,
}));

export function StepRequirements({
  values,
  errors,
  setField,
  planFile,
  planFileError,
  onPlanFileChange,
}: StepRequirementsProps) {
  return (
    <section className="space-y-5">
      <h2 className="text-lg font-bold text-brand-black">
        2. House Requirements
      </h2>

      <OptionCards
        legend="House Type"
        required
        options={HOUSE_TYPE_OPTIONS}
        value={values.houseType}
        error={errors.houseType}
        onChange={(v) => setField("houseType", v)}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          id="floors"
          label="Number of Floors"
          required
          icon={<Layers className="size-4" />}
          placeholder="Select number of floors"
          options={floorOptions}
          value={values.floors}
          error={errors.floors}
          onChange={(v) => setField("floors", v)}
        />
        <SelectField
          id="bedrooms"
          label="Bedrooms"
          required
          icon={<BedDouble className="size-4" />}
          placeholder="Select number of bedrooms"
          options={bedroomOptions}
          value={values.bedrooms}
          error={errors.bedrooms}
          onChange={(v) => setField("bedrooms", v)}
        />
        <SelectField
          id="budget"
          label="Budget Range"
          required
          icon={<Wallet className="size-4" />}
          placeholder="Select budget range"
          options={asOptions(BUDGET_RANGES)}
          value={values.budgetRange}
          error={errors.budgetRange}
          onChange={(v) => setField("budgetRange", v)}
        />
        <TextField
          id="plot-size"
          label="Approx. Plot Size (Sq. Yards)"
          required
          type="number"
          min={0}
          inputMode="decimal"
          icon={<Ruler className="size-4" />}
          placeholder="e.g. 120, 240, 500"
          value={values.plotSizeSqYd}
          error={errors.plotSizeSqYd}
          onChange={(e) => setField("plotSizeSqYd", e.target.value)}
        />
        <TextField
          id="covered-area"
          label="Estimated Covered Area (Sq. Ft.)"
          required
          type="number"
          min={0}
          inputMode="decimal"
          icon={<Square className="size-4" />}
          placeholder="e.g. 1,500"
          value={values.coveredAreaSqFt}
          error={errors.coveredAreaSqFt}
          onChange={(e) => setField("coveredAreaSqFt", e.target.value)}
        />
        <SelectField
          id="timeline"
          label="Preferred Construction Timeline"
          required
          icon={<Calendar className="size-4" />}
          placeholder="Select timeline"
          options={asOptions(TIMELINES)}
          value={values.timeline}
          error={errors.timeline}
          onChange={(v) => setField("timeline", v)}
        />
      </div>

      <OptionCards
        legend="Material / Finish Category"
        required
        options={CATEGORY_OPTIONS}
        value={values.category}
        error={errors.category}
        onChange={(v) => setField("category", v)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <FileDropzone
          id="plan-file"
          label="Upload Plot Plan"
          file={planFile}
          error={planFileError}
          onChange={onPlanFileChange}
        />
        <NotesField
          id="notes"
          label="Additional Requirements (optional)"
          value={values.additionalNotes}
          maxLength={MAX_NOTES_LENGTH}
          error={errors.additionalNotes}
          onChange={(v) => setField("additionalNotes", v)}
        />
      </div>
    </section>
  );
}
