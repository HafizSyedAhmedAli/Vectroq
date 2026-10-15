import { isUnsearchedType, RATE_ITEM_TYPES } from "@tmcc/shared-types";
import type { RateCard, RateItemType } from "@tmcc/shared-types";

// There are deliberately NO built-in rates here. Every unit rate on a BOQ
// comes from a live, city-specific AI search (see @tmcc/rate-research), saved
// as a RateSet and read back through apps/web/src/lib/rate-sets.ts.
//
// Sales tax is not stored with rates: it depends on the engagement model
// (see MODEL_TAX_PERCENT in @tmcc/shared-types).

/** Item types a rate card still needs before it can price a full BOQ. */
export function missingItemTypes(card: RateCard | undefined): RateItemType[] {
  const have = new Set(card?.items.map((i) => i.itemType));
  return RATE_ITEM_TYPES.filter((t) => !isUnsearchedType(t) && !have.has(t));
}

export const isCompleteRateCard = (card: RateCard | undefined): boolean =>
  !!card && missingItemTypes(card).length === 0;
