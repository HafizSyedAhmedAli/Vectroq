import { calculateBoq } from "@tmcc/boq-engine";
import {
  taxPercentForModel,
  type BOQResult,
  type EngagementModel,
  type Geometry,
  type RateCard,
} from "@tmcc/shared-types";

export interface EstimateProjectInput {
  geometry: Geometry;
  /** Decides the sales tax rate. */
  model: EngagementModel;
  /** Live city/category rate card. There is no built-in fallback. */
  rateCard?: RateCard;
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
    taxPercentForModel(input.model),
  );
}
