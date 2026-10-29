import { describe, it, expect } from "vitest";
import {
  DEFAULT_EXCLUSIONS,
  DEFAULT_ORG_RULES,
  RATE_ITEM_TYPES,
  buildAssumptions,
  type BOQResult,
} from "@vectroq/shared-types";
import {
  ASSUMPTIONS,
  BOQ_META,
  EXCLUSIONS,
  GROUPS,
  estimateRange,
  formatPkr,
  formatQty,
  formatShort,
  groupBoq,
  taxPercent,
  unitLabel,
  unitSingular,
} from "./boq-format";

const li = (
  itemType: string,
  quantity: number,
  unit: string,
  unitRate: number,
) => ({
  itemType: itemType as never,
  quantity,
  unit,
  unitRate,
  subtotal: quantity * unitRate,
});

describe("units", () => {
  it("labels known units and passes unknown ones through", () => {
    expect(unitLabel("sqft")).toBe("sq ft");
    expect(unitLabel("bath")).toBe("bathrooms");
    expect(unitLabel("1000nos")).toBe("× 1,000 nos");
    expect(unitLabel("weird")).toBe("weird");
    expect(unitSingular("bath")).toBe("bathroom");
    expect(unitSingular("bag")).toBe("bag");
    expect(unitSingular("weird")).toBe("weird");
  });
});

describe("formatting", () => {
  it("formatPkr rounds and groups", () => {
    expect(formatPkr(1234567.6)).toBe("Rs 1,234,568");
    expect(formatPkr(0)).toBe("Rs 0");
  });

  it.each([
    ["ton", 2.567, "2.57"],
    ["1000nos", 2.7, "2.7"],
    ["bag", 30.4, "30"],
    ["bath", 2, "2"],
    ["sqft", 200.46, "200.5"],
    ["cft", 129.04, "129"],
    ["sqft", 12345.67, "12,345.7"],
  ])("formatQty(%s, %s) = %s", (unit, quantity, expected) => {
    expect(formatQty(li("x", quantity, unit, 1))).toBe(expected);
  });

  it("formatShort uses lakh below a crore and crore above", () => {
    expect(formatShort(6_640_000)).toBe("Rs 66.4 lakh");
    expect(formatShort(12_500_000)).toBe("Rs 1.25 crore");
    expect(formatShort(10_000_000)).toBe("Rs 1.00 crore");
  });

  it("estimateRange is a ±10% band rounded to the nearest lakh", () => {
    expect(estimateRange(6_600_000)).toBe("Rs 59.0 lakh – Rs 73.0 lakh");
    expect(estimateRange(10_000_000)).toBe("Rs 90.0 lakh – Rs 1.10 crore");
  });
});

describe("groupBoq", () => {
  it("groups in display order, drops empty groups and totals each", () => {
    const boq: BOQResult = {
      lineItems: [
        li("brick", 2, "1000nos", 100),
        li("foundation", 10, "sqft", 10),
        li("masonry", 5, "sqft", 20),
        li("mystery", 1, "zz", 7),
      ],
      subtotal: 0,
      tax: 0,
      total: 0,
    };
    const g = groupBoq(boq);
    expect(g.map((x) => x.group)).toEqual([
      "Structure",
      "Masonry & Plaster",
      "Materials",
    ]);
    expect(g[0].subtotal).toBe(100);
    expect(g[2].items).toHaveLength(2); // unknown types land in Materials
    expect(g[2].subtotal).toBe(207);
  });

  it("returns nothing for an empty BOQ", () => {
    expect(groupBoq({ lineItems: [], subtotal: 0, tax: 0, total: 0 })).toEqual(
      [],
    );
  });
});

describe("taxPercent", () => {
  it("derives the rate from tax and subtotal, 0 for an empty BOQ", () => {
    expect(
      taxPercent({ lineItems: [], subtotal: 1000, tax: 150, total: 1150 }),
    ).toBe(15);
    expect(taxPercent({ lineItems: [], subtotal: 0, tax: 0, total: 0 })).toBe(
      0,
    );
  });
});

describe("constants", () => {
  it("every rate item type has a label and a known group", () => {
    for (const t of RATE_ITEM_TYPES) {
      expect(BOQ_META[t].label.length).toBeGreaterThan(0);
      expect(GROUPS).toContain(BOQ_META[t].group);
    }
  });

  it("the legacy copies of the notes have not drifted from the defaults", () => {
    expect(ASSUMPTIONS).toEqual(buildAssumptions(DEFAULT_ORG_RULES));
    expect(EXCLUSIONS).toEqual(DEFAULT_EXCLUSIONS);
  });
});
