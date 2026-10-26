import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShareLinkPanel } from "./ShareLinkPanel";

const fetchMock = vi.fn();
const res = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const future = new Date(Date.now() + 5 * 86400_000).toISOString();
const past = new Date(Date.now() - 86400_000).toISOString();

describe("ShareLinkPanel", () => {
  it("offers to create a link when none exists", () => {
    render(<ShareLinkPanel projectId="p1" initial={null} />);
    expect(screen.getByRole("button", { name: /create link/i })).toBeInTheDocument();
    expect(screen.queryByLabelText("Share link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /revoke/i })).not.toBeInTheDocument();
  });

  it("shows the existing link, expiry and replace/revoke actions", () => {
    render(<ShareLinkPanel projectId="p1" initial={{ token: "tok", expiresAt: future, label: "1 Nov 2026" }} />);
    expect(screen.getByLabelText("Share link")).toHaveValue(`${window.location.origin}/client/tok`);
    expect(screen.getByText("Expires 1 Nov 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /replace link/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /revoke/i })).toBeInTheDocument();
  });

  it("hides the link and shows Expired when the share has expired", () => {
    render(<ShareLinkPanel projectId="p1" initial={{ token: "tok", expiresAt: past, label: "Yesterday" }} />);
    expect(screen.queryByLabelText("Share link")).not.toBeInTheDocument();
    expect(screen.getByText("Expired Yesterday")).toBeInTheDocument();
  });

  it("creates a link with the chosen duration", async () => {
    fetchMock.mockReturnValue(res({ token: "newtok", expiresAt: future }));
    render(<ShareLinkPanel projectId="p1" initial={null} />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Link duration"), "90");
    await user.click(screen.getByRole("button", { name: /create link/i }));
    expect(await screen.findByLabelText("Share link")).toHaveValue(`${window.location.origin}/client/newtok`);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/projects/p1/share");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ days: 90 });
    expect(screen.getByRole("button", { name: /replace link/i })).toBeInTheDocument();
  });

  it("shows an error when creation fails", async () => {
    fetchMock.mockReturnValue(res({ error: "Finalize the project first." }, 400));
    render(<ShareLinkPanel projectId="p1" initial={null} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /create link/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Finalize the project first.");
    expect(screen.queryByLabelText("Share link")).not.toBeInTheDocument();
  });

  it("uses a generic error when the response has no message", async () => {
    fetchMock.mockReturnValue(Promise.resolve({ ok: false, status: 500, json: () => Promise.reject(new Error("x")) }));
    render(<ShareLinkPanel projectId="p1" initial={null} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /create link/i }));
    expect(await screen.findByText("Could not create the link.")).toBeInTheDocument();
  });

  it("revokes the link", async () => {
    fetchMock.mockReturnValue(res({}));
    render(<ShareLinkPanel projectId="p1" initial={{ token: "tok", expiresAt: future, label: "x" }} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /revoke/i }));
    expect(await screen.findByRole("button", { name: /create link/i })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/p1/share", { method: "DELETE" });
  });

  it("copies the link to the clipboard", async () => {
    const user = userEvent.setup();
    render(<ShareLinkPanel projectId="p1" initial={{ token: "tok", expiresAt: future, label: "x" }} />);
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/client/tok`);
  });
});
