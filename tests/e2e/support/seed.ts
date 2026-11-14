// Deterministic, clearly synthetic pricing data for E2E.
//
// The app ships no built-in rates (a company must have an APPROVED rate set for a
// city and category, or its BOQ stays unpriced). This creates one SHARED set
// (organizationId = null, visible to every company) per category for Karachi.
// The numbers are invented, not market prices; they only need to be stable.
import { RATE_ITEM_TYPES } from "../../../packages/shared-types/src/index";
import { testRateCard } from "../../../packages/rate-cards/src/test-rate-card";

type Prisma = typeof import("../../../packages/db/src/index").prisma;

export const SEED_CITY = "Karachi";
export const SEED_CATEGORIES = ["A", "B", "C"] as const;
export const SEED_APPROVER = "e2e-seed";
/** Stable ids so a test can find "the" synthetic rate set. */
export const rateSetId = (category: string) => `e2e-rateset-karachi-${category.toLowerCase()}`;

// Synthetic unit rates, per item type (units come from the shared test fixture).
const BASE: Record<string, number> = {
  masonry: 120, plaster: 60, shuttering: 90, steelFixing: 14000, sanitary: 45000,
  tileFixing: 80, marbleFixing: 150, woodwork: 900, falseCeiling: 300, foundation: 500,
  rccRoof: 700, electrical: 400, paint: 40, brick: 17000, cement: 1300, sand: 80,
  steelMaterial: 250000,
};
const CATEGORY_FACTOR = { A: 1.2, B: 1, C: 0.85 } as const;

export function syntheticItems(category: (typeof SEED_CATEGORIES)[number]) {
  const card = testRateCard({ city: SEED_CITY, category });
  return card.items.map((i) => ({
    ...i,
    unitRate: Math.round((BASE[i.itemType] ?? 100) * CATEGORY_FACTOR[category]),
  }));
}

export async function seedRateSets(prisma: Prisma): Promise<void> {
  for (const category of SEED_CATEGORIES) {
    const data = {
      city: SEED_CITY,
      category,
      status: "APPROVED",
      origin: "manual",
      taxPercent: 17,
      items: syntheticItems(category),
      sources: RATE_ITEM_TYPES.map((itemType) => ({
        itemType,
        sourceUrl: "",
        sourceDate: "",
        note: "E2E synthetic value, not a market price",
      })),
      approvedAt: new Date("2026-01-01T00:00:00Z"),
      approvedBy: SEED_APPROVER,
      organizationId: null,
    };
    await prisma.rateSet.upsert({
      where: { id: rateSetId(category) },
      create: { id: rateSetId(category), ...data },
      update: data,
    });
  }
}
