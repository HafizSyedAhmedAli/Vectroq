// apps/web/src/components/intake/NotesField.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotesField } from "./NotesField";

describe("NotesField", () => {
  it("shows a live character counter", () => {
    render(
      <NotesField
        id="n"
        label="Notes"
        value="hello"
        maxLength={500}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("5/500")).toBeInTheDocument();
    expect(screen.getByLabelText("Notes")).toHaveAttribute("maxlength", "500");
  });

  it("reports typing", async () => {
    const onChange = vi.fn();
    render(
      <NotesField
        id="n"
        label="Notes"
        value=""
        maxLength={500}
        onChange={onChange}
      />,
    );
    await userEvent.setup().type(screen.getByLabelText("Notes"), "a");
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("shows an error", () => {
    render(
      <NotesField
        id="n"
        label="Notes"
        value=""
        maxLength={500}
        error="Too long."
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Too long.");
  });
});
