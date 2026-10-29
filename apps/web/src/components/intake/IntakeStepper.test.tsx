// apps/web/src/components/intake/IntakeStepper.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntakeStepper } from "./IntakeStepper";

const steps = [
  { id: "a", label: "Project Details" },
  { id: "b", label: "Requirements" },
  { id: "c", label: "Contact" },
];

describe("IntakeStepper", () => {
  it("marks the current step", () => {
    render(<IntakeStepper steps={steps} current={1} onStepClick={() => {}} />);
    const items = screen.getAllByRole("listitem");
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[0]).not.toHaveAttribute("aria-current");
  });

  it("only completed steps are clickable", async () => {
    const onStepClick = vi.fn();
    render(
      <IntakeStepper steps={steps} current={2} onStepClick={onStepClick} />,
    );
    const [a, b, c] = screen.getAllByRole("button");
    expect(a).toBeEnabled();
    expect(b).toBeEnabled();
    expect(c).toBeDisabled();
    await userEvent.setup().click(a);
    expect(onStepClick).toHaveBeenCalledWith(0);
  });

  it("can't jump forward", async () => {
    const onStepClick = vi.fn();
    render(
      <IntakeStepper steps={steps} current={0} onStepClick={onStepClick} />,
    );
    const buttons = screen.getAllByRole("button");
    buttons.forEach((b) => expect(b).toBeDisabled());
    await userEvent.setup().click(buttons[2]);
    expect(onStepClick).not.toHaveBeenCalled();
  });

  it("shows numbers for pending steps and checks for done ones", () => {
    render(<IntakeStepper steps={steps} current={1} onStepClick={() => {}} />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });
});
