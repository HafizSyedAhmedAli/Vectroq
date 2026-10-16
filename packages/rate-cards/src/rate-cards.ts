import { isUnsearchedType, RATE_ITEM_TYPES } from "@vectroq/shared-types";
import type { RateCard, RateItemType } from "@vectroq/shared-types";

// There are deliberately NO built-in rates here. Every unit rate on a BOQ
// comes from an approved RateSet (an imported CSR or manual entry), read back
// through apps/web/src/lib/rate-sets.ts.
//
// Sales tax is not stored with rates: it depends on the engagement model
// (see MODEL_TAX_PERCENT in @vectroq/shared-types).

/** Item types a rate card still needs before it can price a full BOQ. */
export function missingItemTypes(card: RateCard | undefined): RateItemType[] {
  const have = new Set(card?.items.map((i) => i.itemType));
  return RATE_ITEM_TYPES.filter((t) => !isUnsearchedType(t) && !have.has(t));
}

export const isCompleteRateCard = (card: RateCard | undefined): boolean =>
  !!card && missingItemTypes(card).length === 0;
