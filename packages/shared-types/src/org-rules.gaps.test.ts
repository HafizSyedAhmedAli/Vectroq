import { describe, it, expect } from "vitest";
import {
  DEFAULT_ORG_RULES,
  DEFAULT_EXCLUSIONS,
  boqConfigFromRules,
  buildAssumptions,
  categoryLabelMap,
  categoryName,
  modelLabelMap,
  modelName,
  resolveNotes,
  resolveOrgRules,
  validateOrgRules,
} from "./org-rules";
import type { OrgRules } from "./org-rules";

const clone = (): OrgRules => JSON.parse(JSON.stringify(DEFAULT_ORG_RULES));
const errOf = (r: unknown) => {
  const v = validateOrgRules(r);
  expect(v.ok).toBe(false);
  return v.ok ? "" : v.error;
};

describe("label helpers", () => {
  it("categoryName falls back to the key for unknown categories", () => {
    expect(categoryName(DEFAULT_ORG_RULES, "A")).toBe("Premium");
    expect(categoryName(DEFAULT_ORG_RULES, "Z")).toBe("Z");
  });
  it("categoryLabelMap and modelLabelMap list every key", () => {
    expect(categoryLabelMap(DEFAULT_ORG_RULES)).toEqual({
      A: "Premium",
      B: "Standard",
      C: "Economy",
    });
    expect(Object.keys(modelLabelMap(DEFAULT_ORG_RULES))).toEqual(["1", "2", "3"]);
  });
  it("modelName falls back for unknown models", () => {
    expect(modelName(DEFAULT_ORG_RULES, 2)).toBe("Construction on Client's Plot");
    expect(modelName(DEFAULT_ORG_RULES, 9)).toBe("Model 9");
  });
});

describe("validateOrgRules errors", () => {
  it("rejects non-object input", () => {
    expect(errOf(null)).toMatch(/Service type 1/);
  });
  it("model name, description and tax", () => {
    const a = clone();
    a.models[1].label = "  ";
    expect(errOf(a)).toMatch(/Service type 1: a name is required/);
    const b = clone();
    b.models[2].description = "x".repeat(201);
    expect(errOf(b)).toMatch(/Service type 2: description is too long/);
    const c = clone();
    c.models[3].taxPercent = 101;
    expect(errOf(c)).toMatch(/Service type 3: tax must be between 0 and 100/);
  });
  it("accepts an empty or missing model description", () => {
    const a = clone() as unknown as Record<string, any>;
    a.models[1].description = "";
    delete a.models[2].description;
    const v = validateOrgRules(a);
    expect(v.ok && v.rules.models[2].description).toBe("");
  });
  it("category name, marble flag and ceiling rate", () => {
    const a = clone();
    a.categories.A.label = "";
    expect(errOf(a)).toMatch(/Category A: a name is required/);
    const b = clone() as unknown as Record<string, any>;
    b.categories.B.marbleInLiving = "yes";
    expect(errOf(b)).toMatch(/Category B: choose marble or tiles/);
    const c = clone();
    c.categories.C.falseCeilingRate = -1;
    expect(errOf(c)).toMatch(/Category C: false ceiling rate/);
  });
  it("labour, construction and materials ranges", () => {
    const a = clone();
    a.labour.masonry = 0;
    expect(errOf(a)).toMatch(/Brick masonry rate must be a number/);
    const b = clone();
    b.construction.wallHeightFt = 99;
    expect(errOf(b)).toMatch(/Wall height must be a number between 6 and 30/);
    const c = clone();
    c.materials.steelKgPerSqft = NaN;
    expect(errOf(c)).toMatch(/Steel kg per sq ft/);
    const d = clone() as unknown as Record<string, any>;
    delete d.labour;
    expect(errOf(d)).toMatch(/Brick masonry rate/);
  });
  it("notes validation", () => {
    const base = (notes: unknown) => ({ ...clone(), notes });
    expect(errOf(base({ assumptions: "text" }))).toMatch(/assumptions must be a list/);
    expect(errOf(base({ assumptions: [1] }))).toMatch(/assumptions must be a list/);
    expect(errOf(base({ exclusions: ["x".repeat(301)] }))).toMatch(/at most 300/);
    expect(errOf(base({ exclusions: Array(16).fill("a") }))).toMatch(/At most 15 exclusions/);
  });
  it("trims note lines, drops blanks and maps empty lists to null", () => {
    const v = validateOrgRules({
      ...clone(),
      notes: { assumptions: ["  a  ", "", "b"], exclusions: ["", "  "] },
    });
    expect(v.ok && v.rules.notes).toEqual({
      assumptions: ["a", "b"],
      exclusions: null,
    });
  });
});

describe("resolveOrgRules", () => {
  it("falls back to defaults when merged values are invalid", () => {
    expect(resolveOrgRules({ labour: { masonry: -5 } })).toEqual(DEFAULT_ORG_RULES);
  });
});

describe("boqConfigFromRules", () => {
  it("lists marble categories and passes materials", () => {
    expect(boqConfigFromRules(DEFAULT_ORG_RULES)).toEqual({
      materials: DEFAULT_ORG_RULES.materials,
      marbleCategories: ["A"],
    });
  });
});

describe("buildAssumptions / resolveNotes", () => {
  it("default text mentions marble for A and tiles for B and C", () => {
    const t = buildAssumptions(DEFAULT_ORG_RULES).join("\n");
    expect(t).toContain("Marble in living areas for Category A; tiles for Categories B and C");
    expect(t).toContain("9 in exterior walls");
    expect(t).toContain("4.5 in interior partitions");
  });
  it("covers the all-tile and all-marble variants", () => {
    const tile = clone();
    tile.categories.A.marbleInLiving = false;
    expect(buildAssumptions(tile).join("\n")).toContain("Tile flooring in all areas");
    const marble = clone();
    for (const k of ["A", "B", "C"] as const) marble.categories[k].marbleInLiving = true;
    expect(buildAssumptions(marble).join("\n")).toContain("for all categories");
  });
  it("formats two-marble categories as plural", () => {
    const r = clone();
    r.categories.B.marbleInLiving = true;
    expect(buildAssumptions(r).join("\n")).toContain("Categories A and B; tiles for Category C");
  });
  it("resolveNotes uses custom notes when set, defaults otherwise", () => {
    expect(resolveNotes(DEFAULT_ORG_RULES).exclusions).toEqual(DEFAULT_EXCLUSIONS);
    const r = clone();
    r.notes = { assumptions: ["mine"], exclusions: ["none"] };
    expect(resolveNotes(r)).toEqual({ assumptions: ["mine"], exclusions: ["none"] });
  });
});
