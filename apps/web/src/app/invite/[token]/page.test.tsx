// apps/web/src/app/invite/[token]/page.test.tsx
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
vi.mock("@/components/AcceptInviteForm", () => ({
  AcceptInviteForm: (p: any) => (
    <div
      data-testid="form"
      data-account={String(p.hasAccount)}
      data-token={p.token}
    />
  ),
}));
vi.mock("@vectroq/db", () => ({
  prisma: {
    invitation: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@vectroq/db";
import { sha256 } from "@/lib/auth/tokens";
import InvitePage, { metadata } from "./page";

const inv = (o: Record<string, unknown> = {}) => ({
  email: "new@x.co",
  role: "ESTIMATOR",
  acceptedAt: null,
  expiresAt: new Date(Date.now() + 60_000),
  organization: { name: "Acme" },
  ...o,
});
const page = () => InvitePage({ params: Promise.resolve({ token: "tok" }) });

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.invitation.findUnique as any).mockResolvedValue(inv());
  (prisma.user.findUnique as any).mockResolvedValue(null);
});

describe("Invite page", () => {
  it("keeps the token private", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.referrer).toBe("no-referrer");
  });

  it("finds the invitation by hash", async () => {
    await page();
    expect(prisma.invitation.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: sha256("tok") },
      include: { organization: true },
    });
  });

  it("names the company, role and invited email", async () => {
    render(await page());
    expect(
      screen.getByRole("heading", { name: "Join Acme" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("You've been invited as Estimator (new@x.co)."),
    ).toBeInTheDocument();
  });

  it("asks for a new password when the invitee has no account", async () => {
    render(await page());
    expect(screen.getByTestId("form")).toHaveAttribute("data-account", "false");
  });

  it("asks for the existing password when the invitee already has an account", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "u1" });
    render(await page());
    expect(screen.getByTestId("form")).toHaveAttribute("data-account", "true");
  });

  it.each([
    ["unknown", null],
    ["accepted", inv({ acceptedAt: new Date() })],
    ["expired", inv({ expiresAt: new Date(Date.now() - 1) })],
  ])("rejects a %s invitation", async (_n, row) => {
    (prisma.invitation.findUnique as any).mockResolvedValue(row);
    render(await page());
    expect(
      screen.getByRole("heading", { name: "Invitation not valid" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("form")).not.toBeInTheDocument();
  });
});
