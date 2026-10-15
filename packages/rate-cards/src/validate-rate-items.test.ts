import { describe, it, expect } from "vitest";
import { validateRateItems } from "./validate-rate-items";

describe("validateRateItems", () => {
  it("accepts valid items", () => {
    const r = validateRateItems([
      { itemType: "cement", unit: "bag", unitRate: 1400 },
    ]);
    expect(r).toEqual({
      ok: true,
      items: [{ itemType: "cement", unit: "bag", unitRate: 1400 }],
    });
  });
  it.each([
    [[]],
    [[{ itemType: "gold", unit: "bag", unitRate: 1 }]],
    [[{ itemType: "cement", unit: "kg", unitRate: 1 }]],
    [[{ itemType: "cement", unit: "bag", unitRate: -5 }]],
    [[{ itemType: "cement", unit: "bag", unitRate: "1400" }]],
    [
      [
        { itemType: "cement", unit: "bag", unitRate: 1 },
        { itemType: "cement", unit: "bag", unitRate: 2 },
      ],
    ],
  ])("rejects bad input %#", (input) => {
    expect(validateRateItems(input).ok).toBe(false);
  });
});
