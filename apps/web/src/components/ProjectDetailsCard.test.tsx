// apps/web/src/components/ProjectDetailsCard.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectDetailsCard } from "./ProjectDetailsCard";

const base = {
  modelLabel: "Construction on Client's Plot",
  city: "Karachi",
  houseType: "Villa",
  contact: "0300-1",
  budgetRange: "Rs 1 – 2 crore" as string | null,
};

describe("ProjectDetailsCard", () => {
  it("shows every detail row", () => {
    render(<ProjectDetailsCard {...base} />);
    for (const [label, value] of [
      ["Engagement Model", base.modelLabel],
      ["City", "Karachi"],
      ["House Type", "Villa"],
      ["Client Contact", "0300-1"],
      ["Client Budget", "Rs 1 – 2 crore"],
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByText(value)).toBeInTheDocument();
    }
  });

  it("hides the budget row when there is none", () => {
    render(<ProjectDetailsCard {...base} budgetRange={null} />);
    expect(screen.queryByText("Client Budget")).not.toBeInTheDocument();
  });

  it("promises a callback", () => {
    render(<ProjectDetailsCard {...base} />);
    expect(
      screen.getByText("Our representative will contact you shortly."),
    ).toBeInTheDocument();
  });
});
