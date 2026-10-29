import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, buttonVariants } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "./native-select";

describe("Button", () => {
  it("renders a clickable button with a data-slot", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    const b = screen.getByRole("button", { name: "Save" });
    expect(b).toHaveAttribute("data-slot", "button");
    await userEvent.setup().click(b);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    await userEvent.setup().click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("variants and sizes produce different classes", () => {
    expect(buttonVariants({ variant: "destructive" })).toContain(
      "text-destructive",
    );
    expect(buttonVariants({ variant: "outline" })).toContain("bg-background");
    expect(buttonVariants({ size: "sm" })).toContain("h-7");
    expect(buttonVariants({ size: "icon" })).toContain("size-8");
    expect(buttonVariants()).toContain("bg-primary");
  });

  it("keeps a custom class", () => {
    render(<Button className="extra-class">x</Button>);
    expect(screen.getByRole("button")).toHaveClass("extra-class");
  });
});

describe("Input", () => {
  it("passes props through and carries a data-slot", () => {
    render(
      <Input placeholder="Email" type="email" className="mine" disabled />,
    );
    const i = screen.getByPlaceholderText("Email");
    expect(i).toHaveAttribute("data-slot", "input");
    expect(i).toHaveAttribute("type", "email");
    expect(i).toHaveClass("mine");
    expect(i).toBeDisabled();
  });
});

describe("Label", () => {
  it("labels an input", () => {
    render(
      <>
        <Label htmlFor="x">Hello</Label>
        <input id="x" />
      </>,
    );
    expect(screen.getByLabelText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Hello")).toHaveAttribute("data-slot", "label");
  });
});

describe("NativeSelect", () => {
  it("renders options and reports selection", async () => {
    const onChange = vi.fn();
    render(
      <NativeSelect aria-label="Pick" defaultValue="a" onChange={onChange}>
        <NativeSelectOption value="a">A</NativeSelectOption>
        <NativeSelectOptGroup label="More">
          <NativeSelectOption value="b">B</NativeSelectOption>
        </NativeSelectOptGroup>
      </NativeSelect>,
    );
    const s = screen.getByRole("combobox", { name: "Pick" });
    expect(s).toHaveValue("a");
    await userEvent.setup().selectOptions(s, "b");
    expect(onChange).toHaveBeenCalled();
    expect(s).toHaveValue("b");
  });

  it("applies the size to wrapper and select, and a wrapper class", () => {
    const { container } = render(
      <NativeSelect size="sm" className="wrap" aria-label="s">
        <NativeSelectOption value="a">A</NativeSelectOption>
      </NativeSelect>,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveAttribute("data-slot", "native-select-wrapper");
    expect(wrapper).toHaveAttribute("data-size", "sm");
    expect(wrapper).toHaveClass("wrap");
    expect(screen.getByRole("combobox")).toHaveAttribute("data-size", "sm");
  });
});
