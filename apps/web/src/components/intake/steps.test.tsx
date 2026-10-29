import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CITY_NAMES } from "@vectroq/shared-types";
import { StepConfirm } from "./StepConfirm";
import { StepProjectDetails } from "./StepProjectDetails";
import { MODEL_OPTIONS } from "./option-config";
import { EMPTY_VALUES } from "./types";

describe("StepConfirm", () => {
  it("sets consent when ticked", async () => {
    const setField = vi.fn();
    render(
      <StepConfirm
        values={EMPTY_VALUES}
        errors={{}}
        setField={setField}
        submitError={null}
      />,
    );
    await userEvent
      .setup()
      .click(screen.getByRole("checkbox", { name: /agree to be contacted/i }));
    expect(setField).toHaveBeenCalledWith("consent", true);
  });

  it("reflects the current value", () => {
    render(
      <StepConfirm
        values={{ ...EMPTY_VALUES, consent: true }}
        errors={{}}
        setField={() => {}}
        submitError={null}
      />,
    );
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("shows the consent error and the submit error separately", () => {
    const { rerender } = render(
      <StepConfirm
        values={EMPTY_VALUES}
        errors={{ consent: "Please agree." }}
        setField={() => {}}
        submitError={null}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Please agree.");
    rerender(
      <StepConfirm
        values={EMPTY_VALUES}
        errors={{}}
        setField={() => {}}
        submitError="Server said no."
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Server said no.");
  });
});

describe("StepProjectDetails", () => {
  const setup = (errors = {}) => {
    const setField = vi.fn();
    render(
      <StepProjectDetails
        values={EMPTY_VALUES}
        errors={errors}
        setField={setField}
        modelOptions={MODEL_OPTIONS}
      />,
    );
    return setField;
  };

  it("reports name and contact edits", () => {
    const setField = setup();
    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: "Ali" },
    });
    fireEvent.change(screen.getByLabelText(/contact/i), {
      target: { value: "0300" },
    });
    expect(setField).toHaveBeenCalledWith("name", "Ali");
    expect(setField).toHaveBeenCalledWith("contact", "0300");
  });

  it("offers every supported city plus a placeholder", async () => {
    const setField = setup();
    const select = screen.getByLabelText(/city/i) as HTMLSelectElement;
    expect(select.options).toHaveLength(CITY_NAMES.length + 1);
    await userEvent.setup().selectOptions(select, "Karachi");
    expect(setField).toHaveBeenCalledWith("city", "Karachi");
  });

  it("offers the three engagement models", async () => {
    const setField = setup();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    await userEvent.setup().click(radios[1]);
    expect(setField).toHaveBeenCalledWith("model", 2);
  });

  it("shows validation errors", () => {
    setup({
      name: "Name is required.",
      model: "Engagement model is required.",
    });
    expect(screen.getByText("Name is required.")).toBeInTheDocument();
    expect(
      screen.getByText("Engagement model is required."),
    ).toBeInTheDocument();
  });
});
