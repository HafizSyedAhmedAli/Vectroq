// apps/web/src/app/reset-password/[token]/page.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/auth/AuthShell", () => ({
  AuthShell: ({ title, children }: any) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));
vi.mock("@/components/ResetPasswordForm", () => ({
  ResetPasswordForm: ({ token }: { token: string }) => (
    <div data-testid="form" data-token={token} />
  ),
}));
vi.mock("@vectroq/db", () => ({
  prisma: { passwordReset: { findUnique: vi.fn() } },
}));

import { prisma } from "@vectroq/db";
import { sha256 } from "@/lib/auth/tokens";
import ResetPasswordPage, { metadata } from "./page";

const future = () => new Date(Date.now() + 60_000);
const past = () => new Date(Date.now() - 60_000);
const page = () =>
  ResetPasswordPage({ params: Promise.resolve({ token: "tok" }) });

beforeEach(() => vi.clearAllMocks());

describe("Reset password page", () => {
  it("keeps the token out of search engines and Referer headers", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.referrer).toBe("no-referrer");
  });

  it("looks the token up by its hash, never the raw value", async () => {
    (prisma.passwordReset.findUnique as any).mockResolvedValue(null);
    await page();
    expect(prisma.passwordReset.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: sha256("tok") },
    });
  });

  it("shows the form for a valid token", async () => {
    (prisma.passwordReset.findUnique as any).mockResolvedValue({
      usedAt: null,
      expiresAt: future(),
    });
    render(await page());
    expect(
      screen.getByRole("heading", { name: "Choose a new password" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("form")).toHaveAttribute("data-token", "tok");
  });

  it.each([
    ["unknown", null],
    ["used", { usedAt: new Date(), expiresAt: future() }],
    ["expired", { usedAt: null, expiresAt: past() }],
  ])("shows 'Link expired' for a %s token", async (_n, row) => {
    (prisma.passwordReset.findUnique as any).mockResolvedValue(row);
    render(await page());
    expect(
      screen.getByRole("heading", { name: "Link expired" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Request a new link" }),
    ).toHaveAttribute("href", "/forgot-password");
    expect(screen.queryByTestId("form")).not.toBeInTheDocument();
  });
});
