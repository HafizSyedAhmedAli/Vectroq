// apps/web/src/components/intake/types.ts
import type { BOQResult, Category, EngagementModel } from "@tmcc/shared-types";
import type {
  HouseType,
  LeadIntakeErrors,
  LeadIntakeInput,
} from "@tmcc/lead-intake";

export interface IntakeSubmitResult {
  estimate: BOQResult | null;
}

export type IntakeSubmitHandler = (
  data: LeadIntakeInput,
  planFile: File | null,
) => Promise<IntakeSubmitResult>;

/** Raw form state: inputs and selects hold strings, choices hold typed values. */
export interface IntakeFormValues {
  name: string;
  contact: string;
  city: string;
  model?: EngagementModel;
  houseType?: HouseType;
  floors: string;
  bedrooms: string;
  plotSizeSqYd: string;
  coveredAreaSqFt: string;
  budgetRange: string;
  timeline: string;
  category?: Category;
  additionalNotes: string;
  consent: boolean;
}

export const EMPTY_VALUES: IntakeFormValues = {
  name: "",
  contact: "",
  city: "",
  floors: "",
  bedrooms: "",
  plotSizeSqYd: "",
  coveredAreaSqFt: "",
  budgetRange: "",
  timeline: "",
  additionalNotes: "",
  consent: false,
};

const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

/** Form strings -> the shape the validators and the API expect. */
export function toLeadInput(v: IntakeFormValues): Partial<LeadIntakeInput> {
  return {
    name: v.name,
    contact: v.contact,
    city: v.city,
    model: v.model,
    category: v.category,
    houseType: v.houseType,
    floors: num(v.floors),
    bedrooms: num(v.bedrooms),
    plotSizeSqYd: num(v.plotSizeSqYd),
    coveredAreaSqFt: num(v.coveredAreaSqFt),
    budgetRange: (v.budgetRange || undefined) as
      | LeadIntakeInput["budgetRange"]
      | undefined,
    timeline: (v.timeline || undefined) as
      | LeadIntakeInput["timeline"]
      | undefined,
    additionalNotes: v.additionalNotes.trim() || undefined,
    consent: v.consent,
  };
}

export type SetField = <K extends keyof IntakeFormValues>(
  key: K,
  value: IntakeFormValues[K],
) => void;

export interface StepProps {
  values: IntakeFormValues;
  errors: LeadIntakeErrors;
  setField: SetField;
}
