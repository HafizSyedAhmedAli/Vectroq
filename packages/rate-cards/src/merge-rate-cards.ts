import type { RateCard } from "@tmcc/shared-types";

// `approved` overrides `base` item-by-item. Used to layer office-approved
// rates over freshly researched ones, so a partial approved set is completed
// by live search instead of by any built-in figure.
export function mergeRateCards(
  base: RateCard | undefined,
  approved: RateCard | undefined,
): RateCard | undefined {
  if (!base) return approved;
  if (!approved) return base;

  const byType = new Map(base.items.map((i) => [i.itemType, i]));
  for (const item of approved.items) byType.set(item.itemType, item);

  return {
    ...base,
    items: [...byType.values()],
  };
}
