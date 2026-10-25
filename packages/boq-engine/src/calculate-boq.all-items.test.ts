import { describe, it, expect } from "vitest";
import { RATE_ITEM_TYPES } from "@vectroq/shared-types";
import type { Geometry, RateCard, RateCardItem } from "@vectroq/shared-types";
import { calculateBoq } from "./calculate-boq";
import * as api from "./index";

const geometry: Geometry = {
  walls: [
    {
      id: "w1",
      startX: 0,
      startY: 0,
      endX: 20,
      endY: 0,
      length: 20,
      height: 10,
      thickness: 0.75,
    },
  ],
  rooms: [
    { id: "r1", name: "Lounge", type: "general", area: 100 },
    { id: "r2", name: "Bath", type: "bathroom", area: 40 },
  ],
  openings: [
    {
      id: "o1",
      type: "door",
      width: 3,
      height: 7,
    },
  ],
};

const UNIT: Record<string, RateCardItem["unit"]> = {
  steelFixing: "ton",
  steelMaterial: "ton",
  sanitary: "bath",
  brick: "1000nos",
  cement: "bag",
  sand: "cft",
};

const card = (category: RateCard["category"], extra: Partial<RateCard> = {}) =>
  ({
    city: "X",
    category,
    items: RATE_ITEM_TYPES.map((itemType) => ({
      itemType,
      unit: UNIT[itemType] ?? "sqft",
      unitRate: 10,
    })),
    ...extra,
  }) as RateCard;

describe("calculateBoq quantity bases", () => {
  it("evaluates every item type without throwing", () => {
    const r = calculateBoq(geometry, card("A"));
    for (const l of r.lineItems) {
      expect(l.quantity).toBeGreaterThan(0);
      expect(l.subtotal).toBeCloseTo(l.quantity * l.unitRate);
    }
    const types = r.lineItems.map((l) => l.itemType);
    expect(types).toContain("sanitary");
    expect(types).toContain("masonry");
  });

  it("charges one bathroom for sanitary", () => {
    const r = calculateBoq(geometry, card("A"));
    expect(r.lineItems.find((l) => l.itemType === "sanitary")?.quantity).toBe(1);
  });

  it("uses marble in living areas for category A, tiles for B", () => {
    const a = calculateBoq(geometry, card("A"));
    const b = calculateBoq(geometry, card("B"));
    expect(a.lineItems.some((l) => l.itemType === "marbleFixing")).toBe(true);
    expect(b.lineItems.some((l) => l.itemType === "marbleFixing")).toBe(false);
    const tileA = a.lineItems.find((l) => l.itemType === "tileFixing")!;
    const tileB = b.lineItems.find((l) => l.itemType === "tileFixing")!;
    expect(tileB.quantity).toBeGreaterThan(tileA.quantity);
  });

  it("honours custom marbleCategories", () => {
    const r = calculateBoq(geometry, card("B"), 0, { marbleCategories: ["B"] });
    expect(r.lineItems.some((l) => l.itemType === "marbleFixing")).toBe(true);
  });

  it("defaults tax to 0 when the card has no taxPercent", () => {
    const r = calculateBoq(geometry, card("A", { taxPercent: undefined }));
    expect(r.tax).toBe(0);
    expect(r.total).toBe(r.subtotal);
  });

  it("uses the card tax by default and an explicit override", () => {
    const withCardTax = calculateBoq(geometry, card("A", { taxPercent: 10 }));
    expect(withCardTax.tax).toBeCloseTo(withCardTax.subtotal * 0.1);
    const overridden = calculateBoq(geometry, card("A", { taxPercent: 10 }), 20);
    expect(overridden.tax).toBeCloseTo(overridden.subtotal * 0.2);
  });

  it("drops zero-quantity lines for an empty geometry", () => {
    const r = calculateBoq({ walls: [], rooms: [], openings: [] }, card("A"));
    expect(r.lineItems).toEqual([]);
    expect(r.total).toBe(0);
  });
});

describe("boq-engine index", () => {
  it("re-exports calculateBoq and material helpers", () => {
    expect(typeof api.calculateBoq).toBe("function");
    expect(typeof api.cementBags).toBe("function");
    expect(api.MATERIAL_ASSUMPTIONS).toBeDefined();
  });
});
