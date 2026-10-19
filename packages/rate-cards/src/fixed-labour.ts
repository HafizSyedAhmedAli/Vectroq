import { fixedLabourItems } from "@vectroq/shared-types";
import type { OrgRules, RateCard } from "@vectroq/shared-types";

/**
 * Overlays the company's labour rates on a card (defaults when `rules` is
 * omitted). Labour rates always win over anything found in a CSR or saved in
 * an older rate set, and are identical for every city.
 */
export function withFixedLabour(card: RateCard, rules?: OrgRules): RateCard;
export function withFixedLabour(card: undefined, rules?: OrgRules): undefined;
export function withFixedLabour(
  card: RateCard | undefined,
  rules?: OrgRules,
): RateCard | undefined;
export function withFixedLabour(
  card: RateCard | undefined,
  rules?: OrgRules,
): RateCard | undefined {
  if (!card) return card;
  const fixed = fixedLabourItems(card.category, rules);
  const fixedTypes = new Set(fixed.map((f) => f.itemType));
  return {
    ...card,
    items: [...card.items.filter((i) => !fixedTypes.has(i.itemType)), ...fixed],
  };
}
