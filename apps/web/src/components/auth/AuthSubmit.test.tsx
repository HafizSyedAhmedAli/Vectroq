import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthSubmit } from "./AuthSubmit";

describe("AuthSubmit", () => {
  it("shows children and is enabled when idle", () => {
    render(<AuthSubmit busy={false} busyLabel="Wait…">Go</AuthSubmit>);
    const b = screen.getByRole("button", { name: "Go" });
    expect(b).toBeEnabled();
    expect(b).toHaveAttribute("aria-busy", "false");
    expect(b.querySelectorAll("svg")).toHaveLength(1); // arrow
  });

  it("omits the arrow when arrow=false", () => {
    render(<AuthSubmit busy={false} busyLabel="Wait…" arrow={false}>Go</AuthSubmit>);
    expect(screen.getByRole("button").querySelectorAll("svg")).toHaveLength(0);
  });

  it("is disabled with busy label and spinner when busy", () => {
    render(<AuthSubmit busy busyLabel="Wait…">Go</AuthSubmit>);
    const b = screen.getByRole("button", { name: "Wait…" });
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Go")).not.toBeInTheDocument();
    expect(b.querySelectorAll("svg")).toHaveLength(1); // spinner only
  });
});
