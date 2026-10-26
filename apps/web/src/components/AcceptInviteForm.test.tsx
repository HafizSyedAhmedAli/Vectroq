import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

import { AcceptInviteForm } from "./AcceptInviteForm";

const fetchMock = vi.fn();
const res = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

beforeEach(() => {
  push.mockReset();
  refresh.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("AcceptInviteForm", () => {
  it("asks new users for a name and a new password", () => {
    render(<AcceptInviteForm token="t" hasAccount={false} />);
    expect(screen.getByLabelText("Your name")).toBeInTheDocument();
    expect(screen.getByLabelText(/choose a password/i)).toHaveAttribute("autocomplete", "new-password");
  });

  it("asks existing users only for their existing password", () => {
    render(<AcceptInviteForm token="t" hasAccount />);
    expect(screen.queryByLabelText("Your name")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Your existing password")).toHaveAttribute("autocomplete", "current-password");
  });

  it("accepts the invite and goes to the dashboard", async () => {
    fetchMock.mockReturnValue(res({}));
    render(<AcceptInviteForm token="inv1" hasAccount={false} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Your name"), "Sara");
    await user.type(screen.getByLabelText(/choose a password/i), "password1");
    await user.click(screen.getByRole("button", { name: /join team/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/office/dashboard"));
    expect(refresh).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/invites/accept");
    expect(JSON.parse(init.body)).toEqual({ token: "inv1", name: "Sara", password: "password1" });
  });

  it("shows the server error", async () => {
    fetchMock.mockReturnValue(res({ error: "Invite expired." }, 410));
    render(<AcceptInviteForm token="t" hasAccount />);
    await userEvent.setup().click(screen.getByRole("button", { name: /join team/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invite expired.");
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /join team/i })).toBeEnabled();
  });

  it("falls back to a generic error", async () => {
    fetchMock.mockReturnValue(Promise.resolve({ ok: false, status: 500, json: () => Promise.reject(new Error("x")) }));
    render(<AcceptInviteForm token="t" hasAccount />);
    await userEvent.setup().click(screen.getByRole("button", { name: /join team/i }));
    expect(await screen.findByText("Could not accept the invitation.")).toBeInTheDocument();
  });
});
