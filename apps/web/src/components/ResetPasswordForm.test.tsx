import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { ResetPasswordForm } from "./ResetPasswordForm";

const fetchMock = vi.fn();
const res = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

beforeEach(() => {
  push.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const pw = () => screen.getByLabelText(/new password \(min/i);
const confirm = () => screen.getByLabelText("Confirm new password");
const submit = () => screen.getByRole("button", { name: /set new password/i });

describe("ResetPasswordForm", () => {
  it("blocks mismatched passwords", async () => {
    render(<ResetPasswordForm token="t" />);
    const user = userEvent.setup();
    await user.type(pw(), "password1");
    await user.type(confirm(), "password2");
    await user.click(submit());
    expect(screen.getByRole("alert")).toHaveTextContent("Passwords don't match.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the token and password then redirects to login", async () => {
    fetchMock.mockReturnValue(res({}));
    render(<ResetPasswordForm token="tok123" />);
    const user = userEvent.setup();
    await user.type(pw(), "password1");
    await user.type(confirm(), "password1");
    await user.click(submit());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/login?reset=1"));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/reset");
    expect(JSON.parse(init.body)).toEqual({ token: "tok123", password: "password1" });
  });

  it("shows a link to request a new one when the token expired (410)", async () => {
    fetchMock.mockReturnValue(res({ error: "Link expired." }, 410));
    render(<ResetPasswordForm token="t" />);
    const user = userEvent.setup();
    await user.type(pw(), "password1");
    await user.type(confirm(), "password1");
    await user.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent("Link expired.");
    expect(screen.getByRole("link", { name: /request a new link/i })).toHaveAttribute("href", "/forgot-password");
    expect(push).not.toHaveBeenCalled();
  });

  it("shows other errors without the new-link prompt", async () => {
    fetchMock.mockReturnValue(res({ error: "Password too short." }, 400));
    render(<ResetPasswordForm token="t" />);
    const user = userEvent.setup();
    await user.type(pw(), "abc");
    await user.type(confirm(), "abc");
    await user.click(submit());
    expect(await screen.findByText(/password too short/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /request a new link/i })).not.toBeInTheDocument();
  });

  it("falls back to a generic error", async () => {
    fetchMock.mockReturnValue(Promise.resolve({ ok: false, status: 500, json: () => Promise.reject(new Error("x")) }));
    render(<ResetPasswordForm token="t" />);
    const user = userEvent.setup();
    await user.type(pw(), "a");
    await user.type(confirm(), "a");
    await user.click(submit());
    expect(await screen.findByText(/could not reset your password/i)).toBeInTheDocument();
  });

  it("toggles visibility of both fields", async () => {
    render(<ResetPasswordForm token="t" />);
    const user = userEvent.setup();
    expect(pw()).toHaveAttribute("type", "password");
    expect(confirm()).toHaveAttribute("type", "password");
    await user.click(screen.getAllByRole("button", { name: "Show passwords" })[0]);
    expect(pw()).toHaveAttribute("type", "text");
    expect(confirm()).toHaveAttribute("type", "text");
  });
});
