// apps/web/src/app/forgot-password/page.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/auth/AuthShell", () => ({
  AuthShell: ({ children, footer }: any) => (
    <div>
      {children}
      <footer>{footer}</footer>
    </div>
  ),
}));
vi.mock("@/components/ForgotPasswordForm", () => ({
  ForgotPasswordForm: ({ initialEmail }: { initialEmail: string }) => (
    <div data-testid="form" data-email={initialEmail} />
  ),
}));

import ForgotPasswordPage from "./page";

const page = (email?: string) =>
  ForgotPasswordPage({ searchParams: Promise.resolve({ email }) });

describe("Forgot password page", () => {
  it("prefills the email from the query", async () => {
    render(await page("a@b.co"));
    expect(screen.getByTestId("form")).toHaveAttribute("data-email", "a@b.co");
  });

  it("defaults to empty", async () => {
    render(await page());
    expect(screen.getByTestId("form")).toHaveAttribute("data-email", "");
  });

  it("caps an absurdly long email at 254 characters", async () => {
    render(await page("x".repeat(500)));
    expect(screen.getByTestId("form").getAttribute("data-email")).toHaveLength(
      254,
    );
  });

  it("links back to log in", async () => {
    render(await page());
    expect(
      screen.getByRole("link", { name: "Back to log in" }),
    ).toHaveAttribute("href", "/login");
  });
});
