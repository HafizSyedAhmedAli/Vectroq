// apps/web/src/app/verify-email/[token]/page.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/auth/AuthShell", () => ({
  AuthShell: ({ title, subtitle, children }: any) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </div>
  ),
}));
vi.mock("@/components/VerifyEmailButton", () => ({
  VerifyEmailButton: ({ token }: { token: string }) => (
    <div data-testid="btn" data-token={token} />
  ),
}));
vi.mock("@vectroq/db", () => ({
  prisma: { emailVerification: { findUnique: vi.fn() } },
}));

import { prisma } from "@vectroq/db";
import { sha256 } from "@/lib/auth/tokens";
import VerifyEmailPage, { metadata } from "./page";

const future = () => new Date(Date.now() + 60_000);
const page = () =>
  VerifyEmailPage({ params: Promise.resolve({ token: "tok" }) });

beforeEach(() => vi.clearAllMocks());

describe("Verify email page", () => {
  it("is private and doesn't leak the token", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.referrer).toBe("no-referrer");
  });

  it("looks the token up by hash and includes the user", async () => {
    (prisma.emailVerification.findUnique as any).mockResolvedValue(null);
    await page();
    expect(prisma.emailVerification.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: sha256("tok") },
      include: { user: true },
    });
  });

  it("asks the user to confirm their address", async () => {
    (prisma.emailVerification.findUnique as any).mockResolvedValue({
      usedAt: null,
      expiresAt: future(),
      user: { email: "a@b.co" },
    });
    render(await page());
    expect(
      screen.getByRole("heading", { name: "Confirm your email" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Confirm a@b\.co/)).toBeInTheDocument();
    expect(screen.getByTestId("btn")).toHaveAttribute("data-token", "tok");
  });

  it.each([
    ["unknown", null],
    [
      "used",
      { usedAt: new Date(), expiresAt: future(), user: { email: "a@b.co" } },
    ],
    [
      "expired",
      {
        usedAt: null,
        expiresAt: new Date(Date.now() - 1),
        user: { email: "a@b.co" },
      },
    ],
  ])("shows 'Link expired' for a %s token", async (_n, row) => {
    (prisma.emailVerification.findUnique as any).mockResolvedValue(row);
    render(await page());
    expect(
      screen.getByRole("heading", { name: "Link expired" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("btn")).not.toBeInTheDocument();
  });
});
