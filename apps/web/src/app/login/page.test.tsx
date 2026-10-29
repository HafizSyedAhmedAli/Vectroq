// apps/web/src/app/login/page.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  redirect: (u: string) => {
    throw new Error(`REDIRECT:${u}`);
  },
}));
vi.mock("@/lib/auth/session", () => ({ getAuth: vi.fn() }));
vi.mock("@/components/auth/AuthShell", () => ({
  AuthShell: ({ title, children, footer }: any) => (
    <div>
      <h1>{title}</h1>
      {children}
      <footer>{footer}</footer>
    </div>
  ),
}));
vi.mock("@/components/LoginForm", () => ({
  LoginForm: ({ next }: { next: string }) => (
    <div data-testid="form" data-next={next} />
  ),
}));

import { getAuth } from "@/lib/auth/session";
import LoginPage from "./page";

const page = (sp: { next?: string; reset?: string } = {}) =>
  LoginPage({ searchParams: Promise.resolve(sp) });

beforeEach(() => {
  vi.clearAllMocks();
  (getAuth as any).mockResolvedValue(null);
});

describe("Login page", () => {
  it("defaults to the dashboard after sign-in", async () => {
    render(await page());
    expect(screen.getByTestId("form")).toHaveAttribute(
      "data-next",
      "/office/dashboard",
    );
  });

  it("keeps a safe same-site next path", async () => {
    render(await page({ next: "/office/rules" }));
    expect(screen.getByTestId("form")).toHaveAttribute(
      "data-next",
      "/office/rules",
    );
  });

  it.each([
    "//evil.com",
    "https://evil.com",
    "office/rules",
    "javascript:alert(1)",
  ])("rejects the open-redirect target %s", async (next) => {
    render(await page({ next }));
    expect(screen.getByTestId("form")).toHaveAttribute(
      "data-next",
      "/office/dashboard",
    );
  });

  it("sends an already signed-in user straight to the target", async () => {
    (getAuth as any).mockResolvedValue({ user: {} });
    await expect(page({ next: "/office/rates" })).rejects.toThrow(
      "REDIRECT:/office/rates",
    );
  });

  it("shows the password-updated notice after a reset", async () => {
    render(await page({ reset: "1" }));
    expect(screen.getByRole("status")).toHaveTextContent(/password updated/i);
  });

  it("links to sign-up", async () => {
    render(await page());
    expect(
      screen.getByRole("link", { name: /create your company/i }),
    ).toHaveAttribute("href", "/signup");
  });
});
