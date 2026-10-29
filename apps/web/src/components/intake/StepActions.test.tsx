// apps/web/src/components/intake/StepActions.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StepActions } from "./StepActions";

const setup = (o: Partial<React.ComponentProps<typeof StepActions>> = {}) => {
  const onBack = vi.fn();
  render(<StepActions isFirst={false} isLast={false} isSubmitting={false} onBack={onBack} {...o} />);
  return { onBack };
};

describe("StepActions", () => {
  it("has no Back on the first step", () => {
    setup({ isFirst: true });
    expect(screen.queryByRole("button", { name: /back/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).toHaveAttribute("type", "submit");
  });

  it("Back calls onBack and is a plain button", async () => {
    const { onBack } = setup();
    const back = screen.getByRole("button", { name: /back/i });
    expect(back).toHaveAttribute("type", "button");
    await userEvent.setup().click(back);
    expect(onBack).toHaveBeenCalled();
  });

  it("shows Submit on the last step", () => {
    setup({ isLast: true });
    expect(screen.getByRole("button", { name: /submit project request/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /continue/i })).not.toBeInTheDocument();
  });

  it("locks the buttons while submitting", () => {
    setup({ isLast: true, isSubmitting: true });
    expect(screen.getByRole("button", { name: /submitting/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /back/i })).toBeDisabled();
  });
});