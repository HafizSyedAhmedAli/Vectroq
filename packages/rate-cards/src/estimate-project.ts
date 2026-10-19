import { calculateBoq } from "@vectroq/boq-engine";
import {
  boqConfigFromRules,
  taxPercentForModel,
  type BOQResult,
  type EngagementModel,
  type Geometry,
  type OrgRules,
  type RateCard,
} from "@vectroq/shared-types";

export interface EstimateProjectInput {
  geometry: Geometry;
  /** Decides the sales tax rate (via rules.models, or the defaults). */
  model: EngagementModel;
  /** Live city/category rate card. There is no built-in fallback. */
  rateCard?: RateCard;
  /** The company's business rules; omitted = defaults. */
  rules?: OrgRules;
}

// Returns null when no rate card is supplied — callers must fetch live rates
// first (see getLiveRateCard in the web app).
export function estimateFromGeometry(
  input: EstimateProjectInput,
): BOQResult | null {
  if (!input.rateCard) return null;
  return calculateBoq(
    input.geometry,
    input.rateCard,
    taxPercentForModel(input.model, input.rules),
    input.rules ? boqConfigFromRules(input.rules) : undefined,
  );
}
