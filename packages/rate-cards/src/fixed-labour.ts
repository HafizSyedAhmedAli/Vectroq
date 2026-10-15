import { fixedLabourItems } from "@tmcc/shared-types";
import type { RateCard } from "@tmcc/shared-types";

/**
 * Overlays TM Construction Company's fixed labour rates on a card. Fixed rates
 * always win over anything found by search or saved in an older rate set, and
 * they are identical for every city.
 */
export function withFixedLabour(card: RateCard): RateCard;
export function withFixedLabour(card: undefined): undefined;
export function withFixedLabour(
  card: RateCard | undefined,
): RateCard | undefined;
export function withFixedLabour(
  card: RateCard | undefined,
): RateCard | undefined {
  if (!card) return card;
  const fixed = fixedLabourItems(card.category);
  const fixedTypes = new Set(fixed.map((f) => f.itemType));
  return {
    ...card,
    items: [...card.items.filter((i) => !fixedTypes.has(i.itemType)), ...fixed],
  };
}
