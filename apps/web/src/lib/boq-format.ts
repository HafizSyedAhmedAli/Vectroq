// apps/web/src/lib/boq-format.ts
import type { BOQLineItem, BOQResult, RateItemType } from "@tmcc/shared-types";

export const GROUPS = [
  "Structure",
  "Masonry & Plaster",
  "Finishes",
  "Services & Fixtures",
  "Materials",
] as const;
export type Group = (typeof GROUPS)[number];

export const BOQ_META: Record<RateItemType, { label: string; group: Group }> = {
  foundation: { label: "Foundation, excavation & plinth", group: "Structure" },
  rccRoof: { label: "RCC roof slab & beams (concrete)", group: "Structure" },
  shuttering: { label: "Roof shuttering / centering", group: "Structure" },
  steelFixing: {
    label: "Steel bar cutting & fixing (labour)",
    group: "Structure",
  },
  masonry: { label: "Brick masonry (labour)", group: "Masonry & Plaster" },
  plaster: {
    label: "Plaster, both faces (labour)",
    group: "Masonry & Plaster",
  },
  tileFixing: { label: "Tile flooring (supply & fixing)", group: "Finishes" },
  marbleFixing: {
    label: "Marble flooring (supply & fixing)",
    group: "Finishes",
  },
  falseCeiling: { label: "False ceiling", group: "Finishes" },
  paint: { label: "Paint (walls & ceilings)", group: "Finishes" },
  woodwork: { label: "Doors & windows (woodwork)", group: "Finishes" },
  sanitary: {
    label: "Sanitary fixtures & sewerage",
    group: "Services & Fixtures",
  },
  electrical: {
    label: "Electrical wiring & points",
    group: "Services & Fixtures",
  },
  brick: { label: "Bricks", group: "Materials" },
  cement: { label: "Cement (50 kg bags)", group: "Materials" },
  sand: { label: "Sand", group: "Materials" },
  steelMaterial: { label: "Steel bars, Grade 60", group: "Materials" },
};

const UNIT_LABEL: Record<string, string> = {
  sqft: "sq ft",
  ton: "ton",
  bath: "bathrooms",
  "1000nos": "× 1,000 nos",
  bag: "bags",
  cft: "cft",
};
export const unitLabel = (u: string) => UNIT_LABEL[u] ?? u;

const pkr = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });
export const formatPkr = (n: number) => `Rs ${pkr.format(Math.round(n))}`;

export function formatQty(item: BOQLineItem): string {
  const digits =
    item.unit === "ton" || item.unit === "1000nos"
      ? 2
      : item.unit === "bath" || item.unit === "bag"
        ? 0
        : 1;
  return new Intl.NumberFormat("en-PK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(item.quantity);
}

/** Pakistani-style short amount: "Rs 66.4 lakh" / "Rs 1.25 crore". */
export function formatShort(n: number): string {
  if (n >= 1e7) return `Rs ${(n / 1e7).toFixed(2)} crore`;
  return `Rs ${(n / 1e5).toFixed(1)} lakh`;
}

/** ±10% band rounded to the nearest lakh, for the "rough estimate" shown to a lead. */
export function estimateRange(total: number): string {
  const lo = Math.round((total * 0.9) / 1e5) * 1e5;
  const hi = Math.round((total * 1.1) / 1e5) * 1e5;
  return `${formatShort(lo)} – ${formatShort(hi)}`;
}

export interface GroupSummary {
  group: Group;
  items: BOQLineItem[];
  subtotal: number;
}

export function groupBoq(boq: BOQResult): GroupSummary[] {
  return GROUPS.map((group) => {
    const items = boq.lineItems.filter(
      (i) => (BOQ_META[i.itemType]?.group ?? "Materials") === group,
    );
    return {
      group,
      items,
      subtotal: items.reduce((s, i) => s + i.subtotal, 0),
    };
  }).filter((g) => g.items.length > 0);
}

export const taxPercent = (boq: BOQResult) =>
  boq.subtotal > 0 ? Math.round((boq.tax / boq.subtotal) * 100) : 0;

export const ASSUMPTIONS = [
  "Quantities are measured from the uploaded drawing (wall centre-lines), single storey.",
  "Wall height 10 ft; 9 in exterior walls and 4.5 in interior partitions; door and window openings deducted.",
  "Reinforcement steel allowed at 4 kg per sq ft of covered area.",
  "Marble in living areas for Category A; tiles for Categories B and C. Kitchens and bathrooms are tiled.",
  "Unit rates come from the rate schedule named under the totals and may differ from current market prices; they are subject to confirmation at contract stage.",
];

export const EXCLUSIONS = [
  "Boundary wall, gate, external development and landscaping",
  "Water tank, boring / pump, gas and utility connections",
  "Kitchen cabinets, appliances, light fixtures, furniture and curtains",
  "Design / consultant fees and approval charges",
  "Price changes after the date of this estimate",
];
