import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DownloadPdfButton } from "./DownloadPdfButton";

const fetchMock = vi.fn();
let createUrl: ReturnType<typeof vi.fn>;
let revokeUrl: ReturnType<typeof vi.fn>;
let clicked: HTMLAnchorElement[];

function pdfRes(disposition: string | null = 'attachment; filename="Quote-Raza.pdf"') {
  return Promise.resolve({
    ok: true,
    headers: { get: () => disposition },
    blob: () => Promise.resolve(new Blob(["x"])),
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  clicked = [];
  createUrl = vi.fn(() => "blob:fake");
  revokeUrl = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  URL.createObjectURL = createUrl as never;
  URL.revokeObjectURL = revokeUrl as never;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push(this);
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("DownloadPdfButton", () => {
  it("downloads using the server filename", async () => {
    fetchMock.mockReturnValue(pdfRes());
    render(<DownloadPdfButton href="/api/x/boq-pdf" />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Download PDF" }));
    await waitFor(() => expect(clicked).toHaveLength(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/x/boq-pdf");
    expect(clicked[0].download).toBe("Quote-Raza.pdf");
    expect(clicked[0].href).toBe("blob:fake");
    expect(document.querySelector("a[download]")).toBeNull();
    await waitFor(() => expect(revokeUrl).toHaveBeenCalledWith("blob:fake"), { timeout: 2000 });
  });

  it("falls back to BOQ.pdf when there is no filename", async () => {
    fetchMock.mockReturnValue(pdfRes(null));
    render(<DownloadPdfButton href="/x" />);
    await userEvent.setup().click(screen.getByRole("button"));
    await waitFor(() => expect(clicked).toHaveLength(1));
    expect(clicked[0].download).toBe("BOQ.pdf");
  });

  it("shows the server error message", async () => {
    fetchMock.mockReturnValue(Promise.resolve({ ok: false, json: () => Promise.resolve({ error: "Not finalized." }) }));
    render(<DownloadPdfButton href="/x" />);
    await userEvent.setup().click(screen.getByRole("button"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Not finalized.");
    expect(clicked).toHaveLength(0);
    expect(screen.getByRole("button")).toBeEnabled();
  });

  it("uses a generic message for unreadable errors", async () => {
    fetchMock.mockReturnValue(Promise.resolve({ ok: false, json: () => Promise.reject(new Error("x")) }));
    render(<DownloadPdfButton href="/x" />);
    await userEvent.setup().click(screen.getByRole("button"));
    expect(await screen.findByText("Could not create the PDF.")).toBeInTheDocument();
  });

  it("uses a generic message for non-Error rejections", async () => {
    fetchMock.mockImplementation(() => Promise.reject("boom"));
    render(<DownloadPdfButton href="/x" />);
    await userEvent.setup().click(screen.getByRole("button"));
    expect(await screen.findByText("Could not create the PDF.")).toBeInTheDocument();
  });

  it("shows busy state and ignores clicks while preparing", async () => {
    let resolve!: (v: unknown) => void;
    fetchMock.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<DownloadPdfButton href="/x" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button"));
    const busy = screen.getByRole("button", { name: /preparing pdf/i });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");
    await user.click(busy);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve(await pdfRes());
    await waitFor(() => expect(clicked).toHaveLength(1));
  });

  it("renders the card variant with its own copy, busy and idle", async () => {
    let resolve!: (v: unknown) => void;
    fetchMock.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<DownloadPdfButton href="/x" variant="card" />);
    expect(screen.getByText(/download the project details/i)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button"));
    expect(screen.getByText("Preparing your PDF…")).toBeInTheDocument();
    expect(screen.getByText(/keep this page open/i)).toBeInTheDocument();
    resolve(await pdfRes());
    await waitFor(() => expect(clicked).toHaveLength(1));
  });
});
