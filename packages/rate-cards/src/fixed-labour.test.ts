import { describe, it, expect } from "vitest";
import { withFixedLabour } from "./fixed-labour";
import { missingItemTypes } from "./rate-cards";
import type { RateCard } from "@tmcc/shared-types";

const card = (
  category: RateCard["category"],
  city = "Hyderabad",
): RateCard => ({
  city,
  category,
  taxPercent: 17,
  items: [
    { itemType: "masonry", unit: "sqft", unitRate: 999 }, // stale searched value
    { itemType: "cement", unit: "bag", unitRate: 1400 },
  ],
});

describe("withFixedLabour", () => {
  it("overrides searched labour rates with TMCC's fixed rates", () => {
    const r = withFixedLabour(card("B"));
    const rate = (t: string) => r.items.find((i) => i.itemType === t)?.unitRate;
    expect(rate("masonry")).toBe(50);
    expect(rate("plaster")).toBe(30);
    expect(rate("shuttering")).toBe(45);
    expect(rate("steelFixing")).toBe(10_000);
    expect(rate("sanitary")).toBe(12_000);
    expect(rate("tileFixing")).toBe(50);
    expect(rate("marbleFixing")).toBe(40);
    expect(rate("woodwork")).toBe(350);
    expect(rate("cement")).toBe(1400); // untouched
    expect(r.items.filter((i) => i.itemType === "masonry")).toHaveLength(1);
  });

  it("is identical for every city", () => {
    const labour = (c: RateCard) =>
      c.items.filter((i) => i.itemType !== "cement");
    expect(labour(withFixedLabour(card("B", "Karachi")))).toEqual(
      labour(withFixedLabour(card("B", "Nawabshah"))),
    );
  });

  it("maps the false-ceiling range to the category", () => {
    const fc = (c: RateCard["category"]) =>
      withFixedLabour(card(c)).items.find((i) => i.itemType === "falseCeiling")
        ?.unitRate;
    expect([fc("A"), fc("B"), fc("C")]).toEqual([350, 275, 200]);
  });

  it("leaves only the searched items missing (foundation and electrical are not searched)", () => {
    expect(missingItemTypes(withFixedLabour(card("B"))).sort()).toEqual(
      ["brick", "paint", "rccRoof", "sand", "steelMaterial"].sort(),
    );
  });
});
