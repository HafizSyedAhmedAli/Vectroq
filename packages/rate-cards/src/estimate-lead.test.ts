import { describe, it, expect } from "vitest";
import { estimateLead } from "./estimate-lead";
import { testRateCard } from "./test-rate-card";

describe("estimateLead", () => {
  it("returns a positive total when a live rate card is supplied", () => {
    const result = estimateLead({
      model: 2,
      rateCard: testRateCard({ city: "Karachi", category: "B" }),
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
    const r = estimateLead({ model, rateCard: testRateCard() })!;
    expect(r.tax).toBeCloseTo(r.subtotal * rate, 2);
  });

  it("returns null when no rate card is available (no built-in fallback)", () => {
    expect(estimateLead({ model: 2 })).toBeNull();
  });

  it("scales up with higher unit rates (better materials cost more)", () => {
    const b = estimateLead({
      model: 2,
      rateCard: testRateCard({ category: "B" }, 100),
    })!;
    const a = estimateLead({
      model: 2,
      rateCard: testRateCard({ category: "A" }, 150),
    })!;
    expect(a.total).toBeGreaterThan(b.total);
  });

  it("scales up with a larger engagement model", () => {
    const card = testRateCard();
    const m1 = estimateLead({ model: 1, rateCard: card })!;
    const m3 = estimateLead({ model: 3, rateCard: card })!;
    expect(m3.total).toBeGreaterThan(m1.total);
  });
});
