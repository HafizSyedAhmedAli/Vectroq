import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { SignupForm } from "./SignupForm";
import { ResetPasswordForm } from "./ResetPasswordForm";
import { AcceptInviteForm } from "./AcceptInviteForm";
import { VerifyEmailButton } from "./VerifyEmailButton";

const offline = /can't reach the server/i;

beforeEach(() =>
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new Error("offline"))),
  ),
);
afterEach(() => vi.unstubAllGlobals());

describe("forms recover from a network failure", () => {
  it("SignupForm", async () => {
    render(<SignupForm />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Your name"), "Eren");
    await user.type(screen.getByLabelText("Email"), "e@x.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.type(screen.getByLabelText("Company name"), "Acme");
    await user.click(
      screen.getByRole("button", { name: /create my company/i }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(offline);
    expect(
      screen.getByRole("button", { name: /create my company/i }),
    ).toBeEnabled();
  });

  it("ResetPasswordForm", async () => {
    render(<ResetPasswordForm token="t" />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/new password \(min/i), "password1");
    await user.type(screen.getByLabelText("Confirm new password"), "password1");
    await user.click(screen.getByRole("button", { name: /set new password/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(offline);
    expect(
      screen.getByRole("button", { name: /set new password/i }),
    ).toBeEnabled();
  });

  it("AcceptInviteForm", async () => {
    render(<AcceptInviteForm token="t" hasAccount />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Your existing password"), "pw");
    await user.click(screen.getByRole("button", { name: /join team/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(offline);
    expect(screen.getByRole("button", { name: /join team/i })).toBeEnabled();
  });

  it("VerifyEmailButton", async () => {
    render(<VerifyEmailButton token="t" />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /confirm my email/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(offline);
    expect(
      screen.getByRole("button", { name: /confirm my email/i }),
    ).toBeEnabled();
  });
});
