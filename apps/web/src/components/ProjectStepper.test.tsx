// apps/web/src/components/ProjectStepper.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectStepper } from "./ProjectStepper";

const current = () =>
  screen
    .queryAllByRole("listitem")
    .filter((li) => li.hasAttribute("aria-current"));

describe("ProjectStepper", () => {
  it("shows five steps, the first always done", () => {
    render(<ProjectStepper hasCad={false} hasBoq={false} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
  });

  it("points at 'Upload drawing' when nothing is uploaded", () => {
    render(<ProjectStepper hasCad={false} hasBoq={false} />);
    expect(current()).toHaveLength(1);
    expect(current()[0]).toHaveTextContent("Upload drawing");
  });

  it("points at pricing once a drawing exists", () => {
    render(<ProjectStepper hasCad hasBoq={false} />);
    expect(current()[0]).toHaveTextContent("Review & price BOQ");
  });

  it("has no current step when everything is done", () => {
    render(<ProjectStepper hasCad hasBoq />);
    expect(current()).toHaveLength(0);
  });
});
