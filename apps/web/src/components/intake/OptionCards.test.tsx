// apps/web/src/components/intake/OptionCards.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Home } from "lucide-react";
import { OptionCards } from "./OptionCards";

const options = [
  { value: "House", label: "House" },
  { value: "Villa", label: "Villa" },
];
const described = [
  {
    value: 1 as const,
    label: "Model one",
    description: "Describes one",
    Icon: Home,
  },
  {
    value: 2 as const,
    label: "Model two",
    description: "Describes two",
    Icon: Home,
  },
];

describe("OptionCards", () => {
  it("is a labelled radio group with the selected option checked", () => {
    render(
      <OptionCards
        legend="House Type"
        options={options}
        value="Villa"
        onChange={() => {}}
      />,
    );
    expect(
      screen.getByRole("radiogroup", { name: /house type/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Villa" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "House" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("reports the clicked value", async () => {
    const onChange = vi.fn();
    render(
      <OptionCards
        legend="House Type"
        options={options}
        value={undefined}
        onChange={onChange}
      />,
    );
    await userEvent.setup().click(screen.getByRole("radio", { name: "House" }));
    expect(onChange).toHaveBeenCalledWith("House");
  });

  it("shows descriptions on the tall card layout", () => {
    render(
      <OptionCards
        legend="Model"
        options={described}
        value={1}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("Describes one")).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /model two/i }),
    ).toBeInTheDocument();
  });

  it("marks required fields and shows an error", () => {
    render(
      <OptionCards
        legend="Model"
        options={options}
        value={undefined}
        onChange={() => {}}
        required
        error="Required."
      />,
    );
    expect(screen.getByText("*")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Required.");
  });
});
