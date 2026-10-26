import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChangePasswordForm } from "./ChangePasswordForm";

const fetchMock = vi.fn();
const res = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const cur = () => screen.getByLabelText("Current password");
const next = () => screen.getByLabelText(/new password \(min/i);
const conf = () => screen.getByLabelText("Confirm new password");
const submit = () => screen.getByRole("button", { name: /change password/i });

async function fill(user: ReturnType<typeof userEvent.setup>, n = "newpass123", c = n) {
  await user.type(cur(), "oldpass");
  await user.type(next(), n);
  await user.type(conf(), c);
}

describe("ChangePasswordForm", () => {
  it("requires at least 8 characters", async () => {
    render(<ChangePasswordForm />);
    const user = userEvent.setup();
    await fill(user, "short");
    await user.click(submit());
    expect(screen.getByText("Password must be at least 8 characters.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires matching passwords and clears the error on typing", async () => {
    render(<ChangePasswordForm />);
    const user = userEvent.setup();
    await fill(user, "newpass123", "different1");
    await user.click(submit());
    expect(screen.getByText("Passwords don't match.")).toBeInTheDocument();
    await user.type(conf(), "x");
    expect(screen.queryByText("Passwords don't match.")).not.toBeInTheDocument();
  });

  it("submits, shows success and clears the fields", async () => {
    fetchMock.mockReturnValue(res({}));
    render(<ChangePasswordForm />);
    const user = userEvent.setup();
    await fill(user);
    await user.click(submit());
    expect(await screen.findByRole("status")).toHaveTextContent("Password changed");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/change-password");
    expect(JSON.parse(init.body)).toEqual({ currentPassword: "oldpass", newPassword: "newpass123" });
    expect(cur()).toHaveValue("");
    expect(next()).toHaveValue("");
    expect(conf()).toHaveValue("");
  });

  it("shows the server error and keeps the typed values", async () => {
    fetchMock.mockReturnValue(res({ error: "Current password is wrong." }, 400));
    render(<ChangePasswordForm />);
    const user = userEvent.setup();
    await fill(user);
    await user.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent("Current password is wrong.");
    expect(cur()).toHaveValue("oldpass");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("falls back to a generic error", async () => {
    fetchMock.mockReturnValue(Promise.resolve({ ok: false, status: 500, json: () => Promise.reject(new Error("x")) }));
    render(<ChangePasswordForm />);
    const user = userEvent.setup();
    await fill(user);
    await user.click(submit());
    expect(await screen.findByText("Could not change password.")).toBeInTheDocument();
  });

  it("reports network failure and re-enables the button", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error("offline")));
    render(<ChangePasswordForm />);
    const user = userEvent.setup();
    await fill(user);
    await user.click(submit());
    expect(await screen.findByText(/can't reach the server/i)).toBeInTheDocument();
    expect(submit()).toBeEnabled();
  });

  it("toggles password visibility for all three fields", async () => {
    render(<ChangePasswordForm />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Show passwords" }));
    for (const f of [cur(), next(), conf()]) expect(f).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "Hide passwords" }));
    expect(cur()).toHaveAttribute("type", "password");
  });
});
