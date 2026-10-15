// packages/lead-intake/src/validate-lead.ts
import type { Category, EngagementModel } from "@tmcc/shared-types";
import { findCity } from "@tmcc/shared-types";
import {
  BEDROOM_OPTIONS,
  BUDGET_RANGES,
  FLOOR_OPTIONS,
  HOUSE_TYPES,
  MAX_NOTES_LENGTH,
  TIMELINES,
  type BudgetRange,
  type HouseType,
  type Timeline,
} from "./options";

const MODELS: EngagementModel[] = [1, 2, 3];
const CATEGORIES: Category[] = ["A", "B", "C"];

export interface LeadIntakeInput {
  // Step 1 — project details
  name: string;
  contact: string;
  city: string;
  model: EngagementModel;
  // Step 2 — requirements
  category: Category;
  houseType: HouseType;
  floors: number;
  bedrooms: number;
  plotSizeSqYd: number;
  coveredAreaSqFt: number;
  budgetRange: BudgetRange;
  timeline: Timeline;
  additionalNotes?: string;
  // Step 3 — confirmation
  consent: boolean;
}

export type LeadIntakeErrors = Partial<Record<keyof LeadIntakeInput, string>>;

export interface LeadIntakeResult {
  valid: boolean;
  errors: LeadIntakeErrors;
}

type Input = Partial<LeadIntakeInput>;

const finish = (errors: LeadIntakeErrors): LeadIntakeResult => ({
  valid: Object.keys(errors).length === 0,
  errors,
});

const isPositive = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n) && n > 0;

/** Step 1 — FR-3/FR-4 */
export function validateProjectDetails(input: Input): LeadIntakeResult {
  const errors: LeadIntakeErrors = {};

  if (!input.name?.trim()) errors.name = "Name is required.";
  if (!input.contact?.trim()) errors.contact = "Contact info is required.";

  if (!input.city?.trim()) {
    errors.city = "City is required.";
  } else if (!findCity(input.city)) {
    errors.city = `"${input.city}" is not a supported city.`;
  }

  if (input.model === undefined) {
    errors.model = "Engagement model is required.";
  } else if (!MODELS.includes(input.model)) {
    errors.model = "Model must be 1, 2, or 3.";
  }

  return finish(errors);
}

/** Step 2 */
export function validateRequirements(input: Input): LeadIntakeResult {
  const errors: LeadIntakeErrors = {};

  if (!input.houseType) {
    errors.houseType = "House type is required.";
  } else if (!HOUSE_TYPES.includes(input.houseType)) {
    errors.houseType = "Choose House, Villa or Farmhouse.";
  }

  if (input.floors === undefined) {
    errors.floors = "Number of floors is required.";
  } else if (!(FLOOR_OPTIONS as readonly number[]).includes(input.floors)) {
    errors.floors = "Choose a number of floors from the list.";
  }

  if (input.bedrooms === undefined) {
    errors.bedrooms = "Number of bedrooms is required.";
  } else if (!(BEDROOM_OPTIONS as readonly number[]).includes(input.bedrooms)) {
    errors.bedrooms = "Choose a number of bedrooms from the list.";
  }

  if (input.plotSizeSqYd === undefined) {
    errors.plotSizeSqYd = "Plot size is required.";
  } else if (!isPositive(input.plotSizeSqYd)) {
    errors.plotSizeSqYd = "Plot size must be a positive number.";
  }

  if (input.coveredAreaSqFt === undefined) {
    errors.coveredAreaSqFt = "Covered area is required.";
  } else if (!isPositive(input.coveredAreaSqFt)) {
    errors.coveredAreaSqFt = "Covered area must be a positive number.";
  }

  if (!input.budgetRange) {
    errors.budgetRange = "Budget range is required.";
  } else if (!BUDGET_RANGES.includes(input.budgetRange)) {
    errors.budgetRange = "Choose a budget range from the list.";
  }

  if (!input.timeline) {
    errors.timeline = "Timeline is required.";
  } else if (!TIMELINES.includes(input.timeline)) {
    errors.timeline = "Choose a timeline from the list.";
  }

  if (!input.category) {
    errors.category = "Material category is required.";
  } else if (!CATEGORIES.includes(input.category)) {
    errors.category = "Category must be A, B, or C.";
  }

  if (
    input.additionalNotes &&
    input.additionalNotes.length > MAX_NOTES_LENGTH
  ) {
    errors.additionalNotes = `Keep notes under ${MAX_NOTES_LENGTH} characters.`;
  }

  return finish(errors);
}

/** Step 3 */
export function validateConfirmation(input: Input): LeadIntakeResult {
  const errors: LeadIntakeErrors = {};
  if (input.consent !== true) {
    errors.consent = "Please agree to be contacted so we can follow up.";
  }
  return finish(errors);
}

/** Everything, used by the API route. */
export function validateLeadIntake(input: Input): LeadIntakeResult {
  return finish({
    ...validateProjectDetails(input).errors,
    ...validateRequirements(input).errors,
    ...validateConfirmation(input).errors,
  });
}
