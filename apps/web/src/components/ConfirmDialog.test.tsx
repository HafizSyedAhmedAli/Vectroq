import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./ConfirmDialog";

function setup(over: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog
      title="Delete project?"
      message="This cannot be undone."
      confirmLabel="Delete"
      busy={false}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...over}
    />,
  );
  return { onConfirm, onCancel };
}

describe("ConfirmDialog", () => {
  it("renders title and message as an accessible alertdialog", () => {
    setup();
    const dlg = screen.getByRole("alertdialog", { name: "Delete project?" });
    expect(dlg).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
  });

  it("focuses Cancel on open", () => {
    setup();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("calls onConfirm and onCancel from the buttons", async () => {
    const { onConfirm, onCancel } = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("cancels on Escape", () => {
    const { onCancel } = setup();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("ignores other keys", () => {
    const { onCancel } = setup();
    fireEvent.keyDown(document, { key: "Enter" });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("cancels when the backdrop is clicked but not the dialog", () => {
    const { onCancel } = setup();
    fireEvent.mouseDown(screen.getByRole("alertdialog"));
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByRole("alertdialog").parentElement!);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("is locked while busy", () => {
    const { onCancel } = setup({ busy: true, busyLabel: "Deleting…" });
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.mouseDown(screen.getByRole("alertdialog").parentElement!);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("uses the default busy label", () => {
    setup({ busy: true });
    expect(screen.getByRole("button", { name: "Working…" })).toBeInTheDocument();
  });

  it("removes the key listener on unmount", () => {
    const onCancel = vi.fn();
    const { unmount } = render(
      <ConfirmDialog title="t" message="m" confirmLabel="ok" busy={false} onConfirm={() => {}} onCancel={onCancel} />,
    );
    unmount();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).not.toHaveBeenCalled();
  });
});
