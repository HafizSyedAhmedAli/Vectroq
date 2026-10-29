// apps/web/src/app/signup/page.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/auth/AuthShell", () => ({
  AuthShell: ({ title, children, footer }: any) => (
    <div>
      <h1>{title}</h1>
      {children}
      <footer>{footer}</footer>
    </div>
  ),
}));
vi.mock("@/components/SignupForm", () => ({
  SignupForm: () => <div>signup-form</div>,
}));

import SignupPage from "./page";

describe("Signup page", () => {
  it("renders the form and a link back to log in", () => {
    render(<SignupPage />);
    expect(
      screen.getByRole("heading", { name: "Create your company" }),
    ).toBeInTheDocument();
    expect(screen.getByText("signup-form")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
