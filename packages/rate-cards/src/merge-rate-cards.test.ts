import { describe, it, expect } from "vitest";
import type { RateCard } from "@tmcc/shared-types";
import { mergeRateCards } from "./merge-rate-cards";

const base: RateCard = {
  city: "Nawabshah",
  category: "B",
  items: [{ itemType: "masonry", unit: "sqft", unitRate: 150 }],
};
const approved: RateCard = {
  city: "Nawabshah",
  category: "B",
  items: [
    { itemType: "masonry", unit: "sqft", unitRate: 200 },
    { itemType: "cement", unit: "bag", unitRate: 1400 },
  ],
};

describe("mergeRateCards", () => {
  it("approved items override and add to the base", () => {
    const m = mergeRateCards(base, approved)!;
    expect(m.items.find((i) => i.itemType === "masonry")?.unitRate).toBe(200);
    expect(m.items.some((i) => i.itemType === "cement")).toBe(true);
  });
  it("returns whichever side exists", () => {
    expect(mergeRateCards(base, undefined)).toBe(base);
    expect(mergeRateCards(undefined, approved)).toBe(approved);
    expect(mergeRateCards(undefined, undefined)).toBeUndefined();
  });
});
