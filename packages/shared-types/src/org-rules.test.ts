import { describe, it, expect } from "vitest";
import {
  DEFAULT_ORG_RULES,
  buildAssumptions,
  fixedLabourItems,
  resolveNotes,
  resolveOrgRules,
  taxPercentForModel,
  validateOrgRules,
} from "./index";

describe("org rules", () => {
  it("defaults are valid and unchanged by a round trip", () => {
    const v = validateOrgRules(JSON.parse(JSON.stringify(DEFAULT_ORG_RULES)));
    expect(v).toEqual({ ok: true, rules: DEFAULT_ORG_RULES });
  });

  it("null, junk and partial stored values all resolve to a full rule set", () => {
    expect(resolveOrgRules(null)).toEqual(DEFAULT_ORG_RULES);
    expect(resolveOrgRules("garbage")).toEqual(DEFAULT_ORG_RULES);
    const r = resolveOrgRules({ models: { 2: { taxPercent: 8 } } });
    expect(r.models[2].taxPercent).toBe(8);
    expect(r.models[2].label).toBe(DEFAULT_ORG_RULES.models[2].label);
    expect(r.labour).toEqual(DEFAULT_ORG_RULES.labour);
  });

  it("rejects out-of-range and malformed input with a readable message", () => {
    const bad = (patch: object) =>
      validateOrgRules({ ...DEFAULT_ORG_RULES, ...patch });
    expect(
      bad({
        models: {
          ...DEFAULT_ORG_RULES.models,
          1: { ...DEFAULT_ORG_RULES.models[1], taxPercent: 120 },
        },
      }),
    ).toMatchObject({ ok: false });
    expect(
      bad({ labour: { ...DEFAULT_ORG_RULES.labour, masonry: -5 } }),
    ).toMatchObject({ ok: false });
    expect(
      bad({
        construction: { ...DEFAULT_ORG_RULES.construction, wallHeightFt: "10" },
      }),
    ).toMatchObject({ ok: false });
    expect(
      bad({ notes: { assumptions: "one string", exclusions: null } }),
    ).toMatchObject({ ok: false });
  });

  it("uses the company's tax and labour rates", () => {
    const rules = resolveOrgRules({
      models: { 3: { taxPercent: 2.5 } },
      labour: { masonry: 80 },
      categories: { C: { falseCeilingRate: 123 } },
    });
    expect(taxPercentForModel(3, rules)).toBe(2.5);
    const items = fixedLabourItems("C", rules);
    expect(items.find((i) => i.itemType === "masonry")?.unitRate).toBe(80);
    expect(items.find((i) => i.itemType === "falseCeiling")?.unitRate).toBe(
      123,
    );
  });

  it("generates the assumptions text from the numbers in use", () => {
    const [, walls, steel, finish] = buildAssumptions(DEFAULT_ORG_RULES);
    expect(walls).toBe(
      "Wall height 10 ft; 9 in exterior walls and 4.5 in interior partitions; door and window openings deducted.",
    );
    expect(steel).toContain("4 kg per sq ft");
    expect(finish).toBe(
      "Marble in living areas for Category A; tiles for Categories B and C. Kitchens and bathrooms are tiled.",
    );
    const custom = resolveOrgRules({
      construction: { wallHeightFt: 12 },
      categories: { B: { marbleInLiving: true } },
    });
    expect(buildAssumptions(custom)[1]).toContain("Wall height 12 ft");
    expect(buildAssumptions(custom)[3]).toContain("Categories A and B");
  });

  it("custom note lines replace the generated text", () => {
    const rules = resolveOrgRules({
      notes: { assumptions: ["Custom line"], exclusions: null },
    });
    expect(resolveNotes(rules).assumptions).toEqual(["Custom line"]);
    expect(resolveNotes(rules).exclusions.length).toBeGreaterThan(0);
  });
});
