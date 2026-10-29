import { describe, it, expect } from "vitest";
import { CITY_NAMES } from "@vectroq/shared-types";
import {
  BEDROOM_OPTIONS,
  BUDGET_RANGES,
  CITIES,
  FLOOR_OPTIONS,
  HOUSE_TYPES,
  MAX_NOTES_LENGTH,
  TIMELINES,
} from "./options";
import { validateRequirements, type LeadIntakeInput } from "./validate-lead";

const ok: Partial<LeadIntakeInput> = {
  houseType: "House",
  floors: 1,
  bedrooms: 1,
  plotSizeSqYd: 120,
  coveredAreaSqFt: 900,
  budgetRange: BUDGET_RANGES[0],
  timeline: TIMELINES[0],
  category: "B",
};

describe("options", () => {
  it("the city list is the shared registry", () =>
    expect(CITIES).toBe(CITY_NAMES));

  it("has the expected fixed lists", () => {
    expect(HOUSE_TYPES).toEqual(["House", "Villa", "Farmhouse"]);
    expect([...FLOOR_OPTIONS]).toEqual([1, 2, 3, 4]);
    expect([...BEDROOM_OPTIONS]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(BUDGET_RANGES).toHaveLength(5);
    expect(TIMELINES).toHaveLength(5);
    expect(MAX_NOTES_LENGTH).toBe(500);
  });

  it("budgets run from the lowest band to the highest", () => {
    expect(BUDGET_RANGES[0]).toMatch(/^Under/);
    expect(BUDGET_RANGES.at(-1)).toMatch(/^Above/);
  });

  it("every option the form offers passes validation", () => {
    for (const houseType of HOUSE_TYPES)
      expect(validateRequirements({ ...ok, houseType }).valid).toBe(true);
    for (const floors of FLOOR_OPTIONS)
      expect(validateRequirements({ ...ok, floors }).valid).toBe(true);
    for (const bedrooms of BEDROOM_OPTIONS)
      expect(validateRequirements({ ...ok, bedrooms }).valid).toBe(true);
    for (const budgetRange of BUDGET_RANGES)
      expect(validateRequirements({ ...ok, budgetRange }).valid).toBe(true);
    for (const timeline of TIMELINES)
      expect(validateRequirements({ ...ok, timeline }).valid).toBe(true);
  });
});
