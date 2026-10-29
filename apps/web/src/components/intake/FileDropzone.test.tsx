// apps/web/src/components/intake/FileDropzone.test.tsx
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileDropzone } from "./FileDropzone";

const file = (name = "plan.pdf", size = 2048) => {
  const f = new File(["x"], name);
  Object.defineProperty(f, "size", { value: size });
  return f;
};

describe("FileDropzone", () => {
  it("shows the accepted types and size limit", () => {
    render(
      <FileDropzone
        id="f"
        label="Upload Plot Plan"
        file={null}
        onChange={() => {}}
      />,
    );
    expect(
      screen.getByText(/PDF, DWG, DXF, JPG, JPEG, PNG/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Max 10MB/)).toBeInTheDocument();
    expect(screen.getByText("Upload Plot Plan (optional)")).toBeInTheDocument();
  });

  it("reports a picked file", async () => {
    const onChange = vi.fn();
    render(
      <FileDropzone
        id="f"
        label="Upload Plot Plan"
        file={null}
        onChange={onChange}
      />,
    );
    const f = file();
    await userEvent
      .setup()
      .upload(screen.getByLabelText(/upload plot plan/i), f);
    expect(onChange).toHaveBeenCalledWith(f);
  });

  it("reports a dropped file", () => {
    const onChange = vi.fn();
    render(
      <FileDropzone
        id="f"
        label="Upload Plot Plan"
        file={null}
        onChange={onChange}
      />,
    );
    const f = file();
    fireEvent.drop(screen.getByText(/drag and drop/i).closest("label")!, {
      dataTransfer: { files: [f] },
    });
    expect(onChange).toHaveBeenCalledWith(f);
  });

  it("shows the chosen file with its size and lets you remove it", async () => {
    const onChange = vi.fn();
    render(
      <FileDropzone
        id="f"
        label="x"
        file={file("plan.pdf", 3 * 1024 * 1024)}
        onChange={onChange}
      />,
    );
    expect(screen.getByText("plan.pdf")).toBeInTheDocument();
    expect(screen.getByText("3.0 MB")).toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Remove uploaded file" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("shows KB for small files and the error message", () => {
    render(
      <FileDropzone
        id="f"
        label="x"
        file={file("a.png", 100)}
        error="Bad file"
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("1 KB")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Bad file");
  });
});
