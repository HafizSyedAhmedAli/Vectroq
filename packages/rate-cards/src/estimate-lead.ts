import { calculateBoq } from "@vectroq/boq-engine";
import {
  boqConfigFromRules,
  taxPercentForModel,
  type BOQResult,
  type EngagementModel,
  type OrgRules,
  type RateCard,
} from "@vectroq/shared-types";
import { REFERENCE_GEOMETRY } from "./reference-geometry";

export interface EstimateInput {
  model: EngagementModel;
  /** Live city/category rate card. There is no built-in fallback. */
  rateCard?: RateCard;
  rules?: OrgRules;
}

// Returns null when no live rate card is available.
export function estimateLead(input: EstimateInput): BOQResult | null {
  if (!input.rateCard) return null;
  return calculateBoq(
    REFERENCE_GEOMETRY[input.model],
    input.rateCard,
    taxPercentForModel(input.model, input.rules),
    input.rules ? boqConfigFromRules(input.rules) : undefined,
  );
}
