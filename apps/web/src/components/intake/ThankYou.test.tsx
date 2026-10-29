// apps/web/src/components/intake/ThankYou.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { estimateRange } from "@/lib/boq-format";
import { ThankYou } from "./ThankYou";

describe("ThankYou", () => {
  it("shows the ±10% range when an estimate exists", () => {
    render(
      <ThankYou
        result={{
          estimate: { lineItems: [], subtotal: 0, tax: 0, total: 6_600_000 },
        }}
        onReset={() => {}}
      />,
    );
    expect(screen.getByText(/rough starting range/i)).toBeInTheDocument();
    expect(screen.getByText(estimateRange(6_600_000))).toBeInTheDocument();
    expect(screen.getByText(/not a quote/i)).toBeInTheDocument();
  });

  it("explains when there is no pricing for the area", () => {
    render(<ThankYou result={{ estimate: null }} onReset={() => {}} />);
    expect(
      screen.getByText(/don't have pricing set up for your area/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/rough starting range/i)).not.toBeInTheDocument();
  });

  it("confirms the request and resets the form", async () => {
    const onReset = vi.fn();
    render(<ThankYou result={{ estimate: null }} onReset={onReset} />);
    expect(screen.getByText("Thank You!")).toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /back to homepage/i }));
    expect(onReset).toHaveBeenCalled();
  });
});
