import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/dynamic", () => ({
  default: () => (p: any) => (
    <div
      data-testid="viewer"
      data-cat={p.category}
      data-floor={p.livingFloor}
    />
  ),
}));

import { ViewerPanel } from "./ViewerPanel";

const geo = { walls: [], rooms: [], openings: [] };

describe("ViewerPanel", () => {
  it("asks for a drawing when there is no geometry", () => {
    render(<ViewerPanel geometry={null} />);
    expect(
      screen.getByText("Upload a CAD file above first."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("viewer")).not.toBeInTheDocument();
  });

  it("renders the viewer with the finish settings", () => {
    render(<ViewerPanel geometry={geo} livingFloor="marble" category="A" />);
    expect(screen.getByTestId("viewer")).toHaveAttribute("data-cat", "A");
    expect(screen.getByTestId("viewer")).toHaveAttribute(
      "data-floor",
      "marble",
    );
  });

  it("shows a heading and divider unless bare", () => {
    const { container, rerender } = render(<ViewerPanel geometry={geo} />);
    expect(
      screen.getByRole("heading", { name: "3D Model" }),
    ).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("border-t");
    rerender(<ViewerPanel geometry={geo} bare />);
    expect(
      screen.queryByRole("heading", { name: "3D Model" }),
    ).not.toBeInTheDocument();
    expect(container.firstChild).not.toHaveClass("border-t");
  });
});
