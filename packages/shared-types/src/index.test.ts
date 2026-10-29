import { describe, it, expect } from "vitest";
import {
  CORE_MATERIAL_TYPES,
  DEFAULT_ORG_RULES,
  FIXED_LABOUR_TYPES,
  MODEL_TAX_PERCENT,
  RATE_ITEM_TYPES,
  fixedLabourItems,
  isFixedLabourType,
  isUnsearchedType,
  taxPercentForModel,
} from "./index";

describe("tax", () => {
  it("defaults to 15 / 10 / 5 percent", () => {
    expect(MODEL_TAX_PERCENT).toEqual({ 1: 15, 2: 10, 3: 5 });
    expect(taxPercentForModel(2)).toBe(10);
  });

  it("uses a company's own rate", () => {
    const rules = {
      models: {
        ...DEFAULT_ORG_RULES.models,
        3: { ...DEFAULT_ORG_RULES.models[3], taxPercent: 2.5 },
      },
    };
    expect(taxPercentForModel(3, rules)).toBe(2.5);
    expect(taxPercentForModel(1, rules)).toBe(15);
  });
});

describe("fixedLabourItems", () => {
  it("returns every labour type with the right unit", () => {
    const items = fixedLabourItems("B");
    expect(items.map((i) => i.itemType)).toEqual([...FIXED_LABOUR_TYPES]);
    const unit = (t: string) => items.find((i) => i.itemType === t)!.unit;
    expect(unit("steelFixing")).toBe("ton");
    expect(unit("sanitary")).toBe("bath");
    expect(unit("masonry")).toBe("sqft");
  });

  it("prices the false ceiling by category", () => {
    const fc = (c: "A" | "B" | "C") =>
      fixedLabourItems(c).find((i) => i.itemType === "falseCeiling")!.unitRate;
    expect([fc("A"), fc("B"), fc("C")]).toEqual([350, 275, 200]);
  });

  it("uses a company's labour rates", () => {
    const rules = {
      ...DEFAULT_ORG_RULES,
      labour: { ...DEFAULT_ORG_RULES.labour, masonry: 80 },
    };
    expect(
      fixedLabourItems("A", rules).find((i) => i.itemType === "masonry")!
        .unitRate,
    ).toBe(80);
  });
});

describe("item type helpers", () => {
  it("has 17 unique item types", () => {
    expect(RATE_ITEM_TYPES).toHaveLength(17);
    expect(new Set(RATE_ITEM_TYPES).size).toBe(17);
  });

  it("core materials are all real item types and none are labour", () => {
    for (const t of CORE_MATERIAL_TYPES) {
      expect(RATE_ITEM_TYPES).toContain(t);
      expect(isFixedLabourType(t)).toBe(false);
    }
  });

  it("classifies unsearched and labour types", () => {
    expect(isUnsearchedType("foundation")).toBe(true);
    expect(isUnsearchedType("electrical")).toBe(true);
    expect(isUnsearchedType("cement")).toBe(false);
    expect(isFixedLabourType("masonry")).toBe(true);
    expect(isFixedLabourType("falseCeiling")).toBe(true);
    expect(isFixedLabourType("foundation")).toBe(false);
  });
});
