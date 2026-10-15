// packages/rate-cards/src/test-rate-card.ts
// TEST-ONLY fixture. Not exported from index.ts and never imported by app
// code: the app has no built-in rates, so tests supply their own.
import { RATE_ITEM_TYPES } from "@tmcc/shared-types";
import type { RateCard, RateCardItem } from "@tmcc/shared-types";

const UNIT: Record<string, RateCardItem["unit"]> = {
  steelFixing: "ton",
  steelMaterial: "ton",
  sanitary: "bath",
  brick: "1000nos",
  cement: "bag",
  sand: "cft",
};

export function testRateCard(
  overrides: Partial<RateCard> = {},
  rate = 100,
): RateCard {
  return {
    city: "TestCity",
    category: "B",
    taxPercent: 17,
    items: RATE_ITEM_TYPES.map((itemType) => ({
      itemType,
      unit: UNIT[itemType] ?? "sqft",
      unitRate: rate,
    })),
    ...overrides,
  };
}
