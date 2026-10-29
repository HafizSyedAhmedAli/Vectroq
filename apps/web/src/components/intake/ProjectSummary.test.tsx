// apps/web/src/components/intake/ProjectSummary.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectSummary } from "./ProjectSummary";
import { EMPTY_VALUES } from "./types";
import { CATEGORY_OPTIONS, MODEL_OPTIONS } from "./option-config";

const setup = (v = {}) =>
  render(
    <ProjectSummary
      values={{ ...EMPTY_VALUES, ...v }}
      modelOptions={MODEL_OPTIONS}
      categoryOptions={CATEGORY_OPTIONS}
    />,
  );

describe("ProjectSummary", () => {
  it("says 'Not selected' for every empty row", () => {
    setup();
    expect(screen.getAllByText("Not selected")).toHaveLength(5);
  });

  it("reflects what the visitor has chosen so far", () => {
    setup({
      model: 2,
      city: "Karachi",
      houseType: "Villa",
      category: "B",
      budgetRange: "Rs 1 – 2 crore",
    });
    expect(
      screen.getByText("Construction on Client's Plot"),
    ).toBeInTheDocument();
    expect(screen.getByText("Karachi")).toBeInTheDocument();
    expect(screen.getByText("Villa")).toBeInTheDocument();
    expect(screen.getByText("Category B")).toBeInTheDocument();
    expect(screen.getByText("Rs 1 – 2 crore")).toBeInTheDocument();
    expect(screen.queryByText("Not selected")).not.toBeInTheDocument();
  });

  it("promises a callback", () => {
    setup();
    expect(
      screen.getByText("Our representative will contact you shortly."),
    ).toBeInTheDocument();
  });
});
