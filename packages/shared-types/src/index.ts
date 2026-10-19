import { DEFAULT_ORG_RULES, type OrgRules } from "./org-rules";
export type Category = "A" | "B" | "C";
export type EngagementModel = 1 | 2 | 3;

export interface Wall {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  length: number;
  height: number;
  thickness: number;
}

export type RoomType = "bathroom" | "kitchen" | "general";

export interface Room {
  id: string;
  name: string;
  area: number;
  type: RoomType; // needed for sanitary pricing (bathroom count)
}

export interface Opening {
  id: string;
  type: "door" | "window";
  width: number; // ft — needed for woodwork area
  height: number; // ft — needed for woodwork area
}

export interface Geometry {
  walls: Wall[];
  rooms: Room[];
  openings: Opening[];
}

// Not searched and not required on a rate card. Almost no source publishes
// these as a per-sqft rate, so a live search cannot price them honestly. A
// BOQ built from a card without them simply has no foundation / electrical
// line; office can still add them by hand on the Rates page and they will be
// priced.
export const UNSEARCHED_TYPES = [
  "foundation",
  "electrical",
] as const satisfies readonly RateItemType[];

export const isUnsearchedType = (t: RateItemType): boolean =>
  (UNSEARCHED_TYPES as readonly string[]).includes(t);

export interface RateCardItem {
  itemType: RateItemType;
  unitRate: number;
  unit: "sqft" | "ton" | "bath" | "1000nos" | "bag" | "cft";
}

export interface RateCard {
  city: string;
  category: Category;
  items: RateCardItem[];
  /** Deprecated: tax now comes from the engagement model (see MODEL_TAX_PERCENT). */
  taxPercent?: number;
}

// Defaults only. A company's own values live in OrgRules.models (see org-rules.ts).
export const MODEL_TAX_PERCENT: Record<EngagementModel, number> = {
  1: DEFAULT_ORG_RULES.models[1].taxPercent,
  2: DEFAULT_ORG_RULES.models[2].taxPercent,
  3: DEFAULT_ORG_RULES.models[3].taxPercent,
};

export const taxPercentForModel = (
  model: EngagementModel,
  rules: Pick<OrgRules, "models"> = DEFAULT_ORG_RULES,
): number => rules.models[model].taxPercent;

export interface BOQLineItem {
  itemType: RateItemType;
  quantity: number;
  unit: string;
  unitRate: number;
  subtotal: number;
}

export interface RateBasisInfo {
  /** "Sindh CSR 2026", or "Office-approved rates" for manual sets. */
  label: string;
  /** Place whose rates were actually used. */
  place: string;
  /** The project's own city. */
  requestedCity: string;
  /** True when `place` is not the project's own city. */
  isFallback: boolean;
  origin: string; // "csr" | "manual"
}

export interface BOQResult {
  lineItems: BOQLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  /** Which rate schedule priced this BOQ. Absent on BOQs saved before this existed. */
  rateBasis?: RateBasisInfo;
}

export const RATE_ITEM_TYPES = [
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

export type RateItemType = (typeof RATE_ITEM_TYPES)[number];

// The four materials that must always appear on a BOQ, priced from a live
// city-specific search (never a built-in figure).
export const CORE_MATERIAL_TYPES = [
  "brick",
  "cement",
  "sand",
  "steelMaterial",
] as const satisfies readonly RateItemType[];

export interface RateCardItem {
  itemType: RateItemType;
  unitRate: number;
  unit: "sqft" | "ton" | "bath" | "1000nos" | "bag" | "cft";
}

// Default labour rates. They are the same in every city, so they are NEVER
// searched and never vary by location.
export const FIXED_LABOUR_TYPES = [
  "masonry",
  "plaster",
  "shuttering",
  "steelFixing",
  "sanitary",
  "tileFixing",
  "marbleFixing",
  "woodwork",
  "falseCeiling",
] as const satisfies readonly RateItemType[];

export const isFixedLabourType = (t: RateItemType): boolean =>
  (FIXED_LABOUR_TYPES as readonly string[]).includes(t);

export function fixedLabourItems(
  category: Category,
  rules: Pick<OrgRules, "labour" | "categories"> = DEFAULT_ORG_RULES,
): RateCardItem[] {
  const l = rules.labour;
  return [
    { itemType: "masonry", unit: "sqft", unitRate: l.masonry },
    { itemType: "plaster", unit: "sqft", unitRate: l.plaster },
    { itemType: "shuttering", unit: "sqft", unitRate: l.shuttering },
    { itemType: "steelFixing", unit: "ton", unitRate: l.steelFixing },
    { itemType: "sanitary", unit: "bath", unitRate: l.sanitary },
    { itemType: "tileFixing", unit: "sqft", unitRate: l.tileFixing },
    { itemType: "marbleFixing", unit: "sqft", unitRate: l.marbleFixing },
    { itemType: "woodwork", unit: "sqft", unitRate: l.woodwork },
    {
      itemType: "falseCeiling",
      unit: "sqft",
      unitRate: rules.categories[category].falseCeilingRate,
    },
  ];
}

export interface Opening {
  id: string;
  type: "door" | "window";
  width: number;
  height: number;
  x?: number;
  y?: number;
  angle?: number; // midpoint + wall angle, ft
}
export interface Room {
  id: string;
  name: string;
  area: number;
  type: RoomType;
  labelX?: number;
  labelY?: number;
}

export * from "./pakistan-cities";
export * from "./org-rules";