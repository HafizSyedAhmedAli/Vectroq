import { describe, it, expect } from "vitest";
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { AuthField } from "./AuthField";

const base = { id: "f", label: "Email", icon: <i data-testid="icon" /> };

describe("AuthField", () => {
  it("links label to input and renders the icon", () => {
    render(<AuthField {...base} />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("id", "f");
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("shows an error as an alert and marks the input invalid", () => {
    render(<AuthField {...base} error="Bad email" hint="ignored hint" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Bad email");
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "f-error");
    expect(screen.queryByText("ignored hint")).not.toBeInTheDocument();
  });

  it("shows a hint when there is no error", () => {
    render(<AuthField {...base} hint="Caps Lock is on" />);
    expect(screen.getByText("Caps Lock is on")).toBeInTheDocument();
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(input).toHaveAttribute("aria-describedby", "f-hint");
  });

  it("has no description or messages by default", () => {
    render(<AuthField {...base} />);
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders the right slot and widens padding", () => {
    render(<AuthField {...base} right={<button>eye</button>} />);
    expect(screen.getByRole("button", { name: "eye" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email").className).toContain("pr-12");
  });

  it("forwards ref and input props", () => {
    const ref = createRef<HTMLInputElement>();
    render(<AuthField {...base} ref={ref} placeholder="type" type="email" />);
    expect(ref.current).toBe(screen.getByPlaceholderText("type"));
    expect(ref.current).toHaveAttribute("type", "email");
  });
});
