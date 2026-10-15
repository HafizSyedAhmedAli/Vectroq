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

export const MODEL_TAX_PERCENT: Record<EngagementModel, number> = {
  1: 15, // Land & Build, Then Sell (company does everything)
  2: 10, // Construction on Client's Plot
  3: 5, // Client's Plot & Client's Construction Cost
};

export const taxPercentForModel = (model: EngagementModel): number =>
  MODEL_TAX_PERCENT[model];

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

// Labour rates published by TM Construction Company itself. They are the same
// in every city, so they are NEVER searched and never vary by location.
// Source: TMCC "Construction mein mazdoori ke rate" rate sheet.
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

// The sheet gives false ceiling as a range (Rs 200-350 / sq ft). We map it to
// the project category: A = 350, B = 275 (midpoint), C = 200. TMCC to confirm.
const FALSE_CEILING_BY_CATEGORY: Record<Category, number> = {
  A: 350,
  B: 275,
  C: 200,
};

export function fixedLabourItems(category: Category): RateCardItem[] {
  return [
    { itemType: "masonry", unit: "sqft", unitRate: 50 },
    { itemType: "plaster", unit: "sqft", unitRate: 30 },
    { itemType: "shuttering", unit: "sqft", unitRate: 45 },
    { itemType: "steelFixing", unit: "ton", unitRate: 10_000 },
    { itemType: "sanitary", unit: "bath", unitRate: 12_000 },
    { itemType: "tileFixing", unit: "sqft", unitRate: 50 },
    { itemType: "marbleFixing", unit: "sqft", unitRate: 40 },
    { itemType: "woodwork", unit: "sqft", unitRate: 350 },
    {
      itemType: "falseCeiling",
      unit: "sqft",
      unitRate: FALSE_CEILING_BY_CATEGORY[category],
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
