import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  FieldError,
  Radio,
  RequiredMark,
  SelectField,
  StepHeading,
  TextField,
} from "./fields";

describe("TextField", () => {
  const base = {
    id: "name",
    label: "Full Name",
    icon: <i data-testid="icon" />,
  };

  it("links the label to the input and marks required fields", () => {
    render(<TextField {...base} required value="" onChange={() => {}} />);
    expect(screen.getByLabelText(/full name/i)).toHaveAttribute("id", "name");
    expect(screen.getByText("*")).toBeInTheDocument();
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("flags an error accessibly", () => {
    render(
      <TextField
        {...base}
        error="Name is required."
        value=""
        onChange={() => {}}
      />,
    );
    expect(screen.getByLabelText(/full name/i)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Name is required.");
  });

  it("is valid with no error, and forwards input props", async () => {
    const onChange = vi.fn();
    render(
      <TextField {...base} placeholder="Enter" value="" onChange={onChange} />,
    );
    const input = screen.getByPlaceholderText("Enter");
    expect(input).toHaveAttribute("aria-invalid", "false");
    await userEvent.setup().type(input, "a");
    expect(onChange).toHaveBeenCalled();
  });
});

describe("SelectField", () => {
  const options = [
    { value: "a", label: "Alpha" },
    { value: "b", label: "Beta" },
  ];

  it("shows the placeholder and options and reports the chosen value", async () => {
    const onChange = vi.fn();
    render(
      <SelectField
        id="city"
        label="City"
        icon={<i />}
        placeholder="Pick one"
        options={options}
        value=""
        onChange={onChange}
      />,
    );
    expect(
      screen.getByRole("option", { name: "Pick one" }),
    ).toBeInTheDocument();
    await userEvent.setup().selectOptions(screen.getByLabelText(/city/i), "b");
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("shows an error", () => {
    render(
      <SelectField
        id="city"
        label="City"
        icon={<i />}
        placeholder="p"
        options={options}
        value=""
        error="City is required."
        onChange={() => {}}
      />,
    );
    expect(screen.getByLabelText(/city/i)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("City is required.");
  });
});

describe("small pieces", () => {
  it("FieldError renders nothing without a message", () => {
    const { container } = render(<FieldError />);
    expect(container).toBeEmptyDOMElement();
  });

  it("Radio shows a check only when on", () => {
    const { container, rerender } = render(<Radio on={false} />);
    expect(container.querySelector("svg")).toBeNull();
    rerender(<Radio on />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("StepHeading and RequiredMark render their content", () => {
    render(
      <>
        <StepHeading>1. Tell us</StepHeading>
        <RequiredMark />
      </>,
    );
    expect(
      screen.getByRole("heading", { name: "1. Tell us" }),
    ).toBeInTheDocument();
    expect(screen.getByText("*")).toBeInTheDocument();
  });
});
