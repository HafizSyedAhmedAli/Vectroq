import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/org", () => ({ requirePage: vi.fn() }));
vi.mock("@/components/ChangePasswordForm", () => ({
  ChangePasswordForm: () => <div>pw-form</div>,
}));
vi.mock("@/components/ResendVerificationButton", () => ({
  ResendVerificationButton: () => <button>resend</button>,
}));

import { requirePage } from "@/lib/org";
import AccountPage from "./page";

const as = (emailVerified: boolean, role = "ESTIMATOR") =>
  (requirePage as any).mockResolvedValue({
    user: { name: "Sara Khan", email: "sara@x.co", emailVerified },
    org: { name: "Acme" },
    role,
  });

describe("Account page", () => {
  it("shows the profile", async () => {
    as(true);
    render(await AccountPage());
    expect(screen.getByText("Sara Khan")).toBeInTheDocument();
    expect(screen.getByText("sara@x.co")).toBeInTheDocument();
    expect(screen.getByText("Estimator")).toBeInTheDocument();
    expect(screen.getByText(/sign-in details for Acme/)).toBeInTheDocument();
    expect(screen.getByText("pw-form")).toBeInTheDocument();
  });

  it("shows a confirmed badge for verified emails", async () => {
    as(true);
    render(await AccountPage());
    expect(screen.getByText("Email confirmed")).toBeInTheDocument();
    expect(screen.queryByText("resend")).not.toBeInTheDocument();
  });

  it("offers to resend when the email isn't verified", async () => {
    as(false);
    render(await AccountPage());
    expect(screen.getByText(/isn't confirmed yet/i)).toBeInTheDocument();
    expect(screen.getByText("resend")).toBeInTheDocument();
    expect(screen.queryByText("Email confirmed")).not.toBeInTheDocument();
  });
});
