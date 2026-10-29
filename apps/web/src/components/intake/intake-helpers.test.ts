import { describe, it, expect } from "vitest";
import { DEFAULT_ORG_RULES } from "@vectroq/shared-types";
import { EMPTY_VALUES, toLeadInput } from "./types";
import {
  CATEGORY_OPTIONS,
  HOUSE_TYPE_OPTIONS,
  MODEL_OPTIONS,
  categoryOptionsFromRules,
  modelOptionsFromRules,
} from "./option-config";

describe("toLeadInput", () => {
  it("converts numeric strings and leaves blanks undefined", () => {
    const r = toLeadInput({
      ...EMPTY_VALUES,
      name: "A",
      floors: "2",
      bedrooms: "",
      plotSizeSqYd: "   ",
      coveredAreaSqFt: " 1800 ",
    });
    expect(r).toMatchObject({ name: "A", floors: 2, coveredAreaSqFt: 1800 });
    expect(r.bedrooms).toBeUndefined();
    expect(r.plotSizeSqYd).toBeUndefined();
  });

  it("turns non-numeric text into NaN so validation can reject it", () => {
    expect(toLeadInput({ ...EMPTY_VALUES, floors: "abc" }).floors).toBeNaN();
  });

  it("trims notes and drops empty ones", () => {
    expect(toLeadInput({ ...EMPTY_VALUES, additionalNotes: "  hi " }).additionalNotes).toBe("hi");
    expect(toLeadInput({ ...EMPTY_VALUES, additionalNotes: "   " }).additionalNotes).toBeUndefined();
  });

  it("maps empty selects to undefined and keeps chosen ones", () => {
    const r = toLeadInput({ ...EMPTY_VALUES, budgetRange: "", timeline: "Just exploring", consent: true });
    expect(r.budgetRange).toBeUndefined();
    expect(r.timeline).toBe("Just exploring");
    expect(r.consent).toBe(true);
  });
});

describe("option config", () => {
  it("builds the three service-type cards from company rules", () => {
    const opts = modelOptionsFromRules(DEFAULT_ORG_RULES.models);
    expect(opts.map((o) => o.value)).toEqual([1, 2, 3]);
    expect(opts[1].label).toBe("Construction on Client's Plot");
    expect(opts[0].Icon).toBeDefined();
  });

  it("drops an empty description so the compact card layout is used", () => {
    const models = {
      ...DEFAULT_ORG_RULES.models,
      2: { ...DEFAULT_ORG_RULES.models[2], description: "" },
    };
    expect(modelOptionsFromRules(models)[1].description).toBeUndefined();
  });

  it("labels categories with their company names", () => {
    const opts = categoryOptionsFromRules(DEFAULT_ORG_RULES.categories);
    expect(opts.map((o) => o.label)).toEqual([
      "Category A · Premium",
      "Category B · Standard",
      "Category C · Economy",
    ]);
  });

  it("exposes defaults and the fixed house types", () => {
    expect(MODEL_OPTIONS).toHaveLength(3);
    expect(CATEGORY_OPTIONS.map((o) => o.value)).toEqual(["A", "B", "C"]);
    expect(HOUSE_TYPE_OPTIONS.map((o) => o.value)).toEqual(["House", "Villa", "Farmhouse"]);
  });
});