import { describe, it, expect } from "vitest";
import { RATE_ITEM_TYPES, isUnsearchedType } from "@vectroq/shared-types";
import { isCompleteRateCard, missingItemTypes } from "./rate-cards";
import { testRateCard } from "./test-rate-card";

describe("missingItemTypes", () => {
  it("returns every searched type when the card is undefined", () => {
    const expected = RATE_ITEM_TYPES.filter((t) => !isUnsearchedType(t));
    expect(missingItemTypes(undefined)).toEqual(expected);
  });

  it("returns nothing for a complete card", () => {
    expect(missingItemTypes(testRateCard())).toEqual([]);
  });

  it("lists items removed from the card", () => {
    const card = testRateCard();
    card.items = card.items.filter((i) => i.itemType !== "paint");
    expect(missingItemTypes(card)).toEqual(["paint"]);
  });
});

describe("isCompleteRateCard", () => {
  it("is false for undefined", () => {
    expect(isCompleteRateCard(undefined)).toBe(false);
  });
  it("is true when nothing is missing", () => {
    expect(isCompleteRateCard(testRateCard())).toBe(true);
  });
  it("is false for an empty card", () => {
    expect(isCompleteRateCard(testRateCard({ items: [] }))).toBe(false);
  });
});
