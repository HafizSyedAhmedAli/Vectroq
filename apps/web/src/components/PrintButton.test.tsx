// apps/web/src/components/PrintButton.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrintButton } from "./PrintButton";

afterEach(() => vi.restoreAllMocks());

describe("PrintButton", () => {
  it("opens the print dialog", async () => {
    const print = vi.fn();
    vi.stubGlobal("print", print);
    render(<PrintButton />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Print / Save as PDF" }));
    expect(print).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("accepts a custom label and hides itself when printing", () => {
    render(<PrintButton label="Print BOQ" />);
    const b = screen.getByRole("button", { name: "Print BOQ" });
    expect(b.className).toContain("print:hidden");
    expect(b).toHaveAttribute("type", "button");
  });
});
