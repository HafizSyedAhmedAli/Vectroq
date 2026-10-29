// apps/web/src/components/ResendVerificationButton.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResendVerificationButton } from "./ResendVerificationButton";

const fetchMock = vi.fn();
const res = (body: unknown = {}, status = 200) =>
  Promise.resolve({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const click = () =>
  userEvent
    .setup()
    .click(screen.getByRole("button", { name: /resend email/i }));

describe("ResendVerificationButton", () => {
  it("posts to the send route", async () => {
    fetchMock.mockReturnValue(res({ ok: true, emailed: true }));
    render(<ResendVerificationButton />);
    await click();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/verify-email/send", {
      method: "POST",
    });
    expect(await screen.findByRole("status")).toHaveTextContent(/email sent/i);
  });

  it("explains when email isn't configured", async () => {
    fetchMock.mockReturnValue(res({ ok: true, emailed: false }));
    render(<ResendVerificationButton />);
    await click();
    expect(await screen.findByRole("status")).toHaveTextContent(
      /isn't configured/i,
    );
  });

  it("tells the user when they're already confirmed", async () => {
    fetchMock.mockReturnValue(res({ ok: true, alreadyVerified: true }));
    render(<ResendVerificationButton />);
    await click();
    expect(await screen.findByRole("status")).toHaveTextContent(
      /already confirmed/i,
    );
  });

  it("shows the cooldown error", async () => {
    fetchMock.mockReturnValue(
      res(
        { error: "Please wait a minute before requesting another email." },
        429,
      ),
    );
    render(<ResendVerificationButton />);
    await click();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /please wait a minute/i,
    );
  });

  it("reports a network failure and re-enables", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error("offline")));
    render(<ResendVerificationButton />);
    await click();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /can't reach the server/i,
    );
    expect(screen.getByRole("button", { name: /resend email/i })).toBeEnabled();
  });
});
