import type { RateCardItem } from "@tmcc/shared-types";

const TYPES = [
  "masonry",
  "plaster",
  "shuttering",
  "steelFixing",
  "sanitary",
  "tileFixing",
  "marbleFixing",
  "woodwork",
  "falseCeiling",
  "foundation",
  "rccRoof",
  "electrical",
  "paint",
  "brick",
  "cement",
  "sand",
  "steelMaterial",
] as const;
const UNITS = ["sqft", "ton", "bath", "1000nos", "bag", "cft"] as const;

export type ValidateResult =
  | { ok: true; items: RateCardItem[] }
  | { ok: false; error: string };

export function validateRateItems(input: unknown): ValidateResult {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, error: "items must be a non-empty array" };
  }
  const seen = new Set<string>();
  const items: RateCardItem[] = [];
  for (const raw of input) {
    const r = raw as Record<string, unknown> | null;
    if (!r || typeof r !== "object")
      return { ok: false, error: "each item must be an object" };
    if (!TYPES.includes(r.itemType as never))
      return { ok: false, error: `unknown itemType "${String(r.itemType)}"` };
    if (!UNITS.includes(r.unit as never))
      return { ok: false, error: `unknown unit "${String(r.unit)}"` };
    if (
      typeof r.unitRate !== "number" ||
      !Number.isFinite(r.unitRate) ||
      r.unitRate <= 0
    ) {
      return {
        ok: false,
        error: `unitRate for ${String(r.itemType)} must be a positive number`,
      };
    }
    if (seen.has(r.itemType as string))
      return { ok: false, error: `duplicate item "${String(r.itemType)}"` };
    seen.add(r.itemType as string);
    items.push({
      itemType: r.itemType as RateCardItem["itemType"],
      unit: r.unit as RateCardItem["unit"],
      unitRate: r.unitRate,
    });
  }
  return { ok: true, items };
}
