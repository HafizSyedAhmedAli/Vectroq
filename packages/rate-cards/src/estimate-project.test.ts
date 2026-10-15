import { describe, it, expect } from "vitest";
import type { Geometry } from "@tmcc/shared-types";
import { estimateFromGeometry } from "./estimate-project";
import { estimateLead } from "./estimate-lead";
import { testRateCard } from "./test-rate-card";

const SMALL_HOUSE: Geometry = {
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
    { id: "r1", name: "Living", area: 300, type: "general" },
    { id: "r2", name: "Bathroom 1", area: 40, type: "bathroom" },
  ],
  openings: [{ id: "o1", type: "door", width: 3, height: 7 }],
};

describe("estimateFromGeometry", () => {
  it("prices a real parsed geometry against a rate card", () => {
    const result = estimateFromGeometry({
      geometry: SMALL_HOUSE,
      model: 2,
      rateCard: testRateCard({ city: "Nawabshah", category: "B" }),
    });
    expect(result).not.toBeNull();
    expect(result!.total).toBeGreaterThan(0);
    expect(result!.tax).toBeCloseTo(result!.subtotal * 0.1, 2);
  });

  it.each([
    [1, 0.15],
    [2, 0.1],
    [3, 0.05],
  ] as const)("applies the model %i tax rate (%f)", (model, rate) => {
    const r = estimateFromGeometry({
      geometry: SMALL_HOUSE,
      model,
      rateCard: testRateCard(),
    })!;
    expect(r.tax).toBeCloseTo(r.subtotal * rate, 2);
  });

  it("returns null when no rate card is supplied, same convention as estimateLead", () => {
    expect(
      estimateFromGeometry({ geometry: SMALL_HOUSE, model: 2 }),
    ).toBeNull();
  });

  it("gives a different total than the archetype-based estimate for the same rate card", () => {
    const rateCard = testRateCard({ city: "Karachi", category: "B" });
    const fromRealGeometry = estimateFromGeometry({
      geometry: SMALL_HOUSE,
      model: 1,
      rateCard,
    })!;
    const fromArchetype = estimateLead({ model: 1, rateCard })!;
    expect(fromRealGeometry.total).toBeGreaterThan(0);
    expect(fromRealGeometry.total).not.toBe(fromArchetype.total);
  });
});
