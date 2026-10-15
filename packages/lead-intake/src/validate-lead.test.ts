// packages/lead-intake/src/validate-lead.test.ts
import { describe, it, expect } from "vitest";
import {
  validateConfirmation,
  validateLeadIntake,
  validateProjectDetails,
  validateRequirements,
  type LeadIntakeInput,
} from "./validate-lead";
import { BUDGET_RANGES, CITIES, TIMELINES } from "./options";

const validInput: LeadIntakeInput = {
  name: "Ahmed Raza",
  contact: "+92-300-1234567",
  city: "Hyderabad",
  model: 2,
  category: "B",
  houseType: "Villa",
  floors: 2,
  bedrooms: 3,
  plotSizeSqYd: 240,
  coveredAreaSqFt: 1800,
  budgetRange: BUDGET_RANGES[2],
  timeline: TIMELINES[1],
  consent: true,
};

describe("validateLeadIntake — full submission", () => {
  it("accepts a fully valid submission (notes are optional)", () => {
    const result = validateLeadIntake(validInput);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("collects errors from every step at once", () => {
    const result = validateLeadIntake({});
    expect(Object.keys(result.errors)).toEqual(
      expect.arrayContaining([
        "name",
        "houseType",
        "floors",
        "plotSizeSqYd",
        "consent",
      ]),
    );
  });
});

describe("validateProjectDetails — FR-3 required fields", () => {
  it.each([
    ["name", { ...validInput, name: "" }],
    ["contact", { ...validInput, contact: "" }],
    ["city", { ...validInput, city: "" }],
  ])("flags missing %s", (field, input) => {
    const result = validateProjectDetails(input as any);
    expect(result.valid).toBe(false);
    expect(result.errors[field as keyof LeadIntakeInput]).toBeDefined();
  });

  it("does not require step-2 or step-3 fields", () => {
    const result = validateProjectDetails({
      name: "A",
      contact: "1",
      city: "Karachi",
      model: 1,
    });
    expect(result.valid).toBe(true);
  });
});

describe("validateProjectDetails — FR-4 predefined lists", () => {
  it("rejects a city not in the predefined list", () => {
    const result = validateProjectDetails({ ...validInput, city: "Atlantis" });
    expect(result.valid).toBe(false);
    expect(result.errors.city).toMatch(/not a supported city/i);
  });

  it("rejects a model outside 1/2/3", () => {
    const result = validateProjectDetails({ ...validInput, model: 4 as any });
    expect(result.errors.model).toBeDefined();
  });

  it("exposes the predefined city list for the form to render", () => {
    expect(CITIES).toContain("Hyderabad");
    expect(CITIES).toContain("Karachi");
  });
});

describe("validateRequirements", () => {
  it("accepts valid requirements", () => {
    expect(validateRequirements(validInput).valid).toBe(true);
  });

  it("rejects a category outside A/B/C", () => {
    const result = validateRequirements({
      ...validInput,
      category: "D" as any,
    });
    expect(result.errors.category).toBeDefined();
  });

  it.each([
    "houseType",
    "floors",
    "bedrooms",
    "plotSizeSqYd",
    "coveredAreaSqFt",
    "budgetRange",
    "timeline",
    "category",
  ] as const)("requires %s", (field) => {
    const input = { ...validInput, [field]: undefined };
    const result = validateRequirements(input);
    expect(result.valid).toBe(false);
    expect(result.errors[field]).toMatch(/required/i);
  });

  it.each([0, -5, NaN])("rejects a non-positive plot size (%s)", (n) => {
    expect(
      validateRequirements({ ...validInput, plotSizeSqYd: n }).errors
        .plotSizeSqYd,
    ).toBeDefined();
  });

  it("rejects values outside the offered lists", () => {
    const r = validateRequirements({
      ...validInput,
      houseType: "Castle" as any,
      floors: 9,
      bedrooms: 20,
      budgetRange: "cheap" as any,
      timeline: "whenever" as any,
    });
    expect(Object.keys(r.errors)).toEqual(
      expect.arrayContaining([
        "houseType",
        "floors",
        "bedrooms",
        "budgetRange",
        "timeline",
      ]),
    );
  });

  it("rejects notes longer than 500 characters", () => {
    const r = validateRequirements({
      ...validInput,
      additionalNotes: "x".repeat(501),
    });
    expect(r.errors.additionalNotes).toBeDefined();
  });
});

describe("validateConfirmation", () => {
  it("requires consent to be exactly true", () => {
    expect(validateConfirmation({ consent: true }).valid).toBe(true);
    expect(validateConfirmation({ consent: false }).valid).toBe(false);
    expect(validateConfirmation({}).valid).toBe(false);
  });
});
