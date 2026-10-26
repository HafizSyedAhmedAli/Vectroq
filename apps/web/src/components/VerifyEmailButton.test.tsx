import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

import { VerifyEmailButton } from "./VerifyEmailButton";

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

const btn = () => screen.getByRole("button", { name: /confirm my email/i });

describe("VerifyEmailButton", () => {
  it("posts the token and goes to the dashboard", async () => {
    fetchMock.mockReturnValue(res({}));
    render(<VerifyEmailButton token="tok" />);
    await userEvent.setup().click(btn());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/office/dashboard"));
    expect(refresh).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/verify-email");
    expect(JSON.parse(init.body)).toEqual({ token: "tok" });
  });

  it("shows the server error and allows retry", async () => {
    fetchMock.mockReturnValue(res({ error: "Link expired." }, 410));
    render(<VerifyEmailButton token="tok" />);
    await userEvent.setup().click(btn());
    expect(await screen.findByRole("alert")).toHaveTextContent("Link expired.");
    expect(btn()).toBeEnabled();
    expect(push).not.toHaveBeenCalled();
  });

  it("falls back to a generic error", async () => {
    fetchMock.mockReturnValue(Promise.resolve({ ok: false, status: 500, json: () => Promise.reject(new Error("x")) }));
    render(<VerifyEmailButton token="tok" />);
    await userEvent.setup().click(btn());
    expect(await screen.findByText("Could not confirm your email.")).toBeInTheDocument();
  });

  it("ignores a second submit while busy", async () => {
    let resolve!: (v: unknown) => void;
    fetchMock.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<VerifyEmailButton token="tok" />);
    const user = userEvent.setup();
    await user.click(btn());
    expect(screen.getByRole("button", { name: /confirming/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /confirming/i }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve({ ok: true, json: () => Promise.resolve({}) });
    await waitFor(() => expect(push).toHaveBeenCalled());
  });
});
