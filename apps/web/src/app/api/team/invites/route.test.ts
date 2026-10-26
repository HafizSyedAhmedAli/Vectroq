// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@vectroq/db", () => ({
  prisma: {
    membership: { findFirst: vi.fn() },
    invitation: { deleteMany: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/auth/guard", () => ({ guard: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/email-templates", () => ({
  inviteEmail: vi.fn(() => ({ subject: "s", html: "h", text: "t" })),
}));
vi.mock("@/lib/app-url", () => ({ appUrl: () => "https://app.test" }));
vi.mock("@/lib/billing/limits", () => ({ seatLimitError: vi.fn() }));
vi.mock("@/lib/billing/plans", () => ({ planOf: vi.fn(() => "FREE") }));
vi.mock("@/lib/billing/usage", () => ({ getUsage: vi.fn(async () => ({})) }));
import { prisma } from "@vectroq/db";
import { guard } from "@/lib/auth/guard";
import { sendEmail } from "@/lib/email";
import { seatLimitError } from "@/lib/billing/limits";

const asRole = (role: string, over: any = {}) =>
  (guard as any).mockImplementation(async (min: string) => {
    const rank: any = { VIEWER: 0, ESTIMATOR: 1, OWNER: 2 };
    return rank[role] >= rank[min]
      ? {
          ok: true,
          auth: {
            org: { id: "org_1", name: "Acme", isDemo: false, ...over.org },
            role,
            user: { id: "u1", name: "Owner", emailVerified: true, ...over.user },
          },
        }
      : { ok: false, res: Response.json({ error: "no" }, { status: 403 }) };
  });
const req = (body: unknown) =>
  new Request("http://localhost/api/team/invites", {
    method: "POST",
    body: JSON.stringify(body),
  }) as any;
const ok = { email: "New@Example.com", role: "ESTIMATOR" };

describe("POST /api/team/invites", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    asRole("OWNER");
    (prisma.membership.findFirst as any).mockResolvedValue(null);
    (prisma.$transaction as any).mockResolvedValue([]);
    (seatLimitError as any).mockReturnValue(null);
    (sendEmail as any).mockResolvedValue(true);
  });

  it("creates an invite, emails it and returns the link", async () => {
    const res = await POST(req(ok));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.emailed).toBe(true);
    expect(body.link).toMatch(/^https:\/\/app\.test\/invite\/.+/);
    expect(prisma.invitation.deleteMany).toHaveBeenCalledWith({
      where: { organizationId: "org_1", email: "new@example.com", acceptedAt: null },
    });
    const data = (prisma.invitation.create as any).mock.calls[0][0].data;
    expect(data).toMatchObject({
      organizationId: "org_1",
      email: "new@example.com",
      role: "ESTIMATOR",
    });
    expect(data.tokenHash).toHaveLength(64);
    expect(data.expiresAt.getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000);
  });

  it("still returns the link when email sending throws", async () => {
    (sendEmail as any).mockRejectedValue(new Error("smtp down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(req(ok));
    expect(res.status).toBe(201);
    expect((await res.json()).emailed).toBe(false);
  });

  it("blocks demo orgs", async () => {
    asRole("OWNER", { org: { isDemo: true } });
    expect((await POST(req(ok))).status).toBe(403);
    expect(prisma.invitation.create).not.toHaveBeenCalled();
  });

  it("requires a verified email", async () => {
    asRole("OWNER", { user: { emailVerified: false } });
    expect((await POST(req(ok))).status).toBe(403);
  });

  it("rejects invalid email and invalid role", async () => {
    expect((await POST(req({ ...ok, email: "nope" }))).status).toBe(400);
    expect((await POST(req({ ...ok, role: "GOD" }))).status).toBe(400);
    expect(prisma.invitation.create).not.toHaveBeenCalled();
  });

  it("returns 402 when the seat limit is reached", async () => {
    (seatLimitError as any).mockReturnValue("Seat limit reached");
    const res = await POST(req(ok));
    expect(res.status).toBe(402);
    expect((await res.json()).code).toBe("PLAN_LIMIT");
  });

  it("returns 409 when the person is already a member", async () => {
    (prisma.membership.findFirst as any).mockResolvedValue({ id: "m1" });
    expect((await POST(req(ok))).status).toBe(409);
    expect(prisma.invitation.create).not.toHaveBeenCalled();
  });

  it("scopes the membership check to the caller's org", async () => {
    await POST(req(ok));
    expect(prisma.membership.findFirst).toHaveBeenCalledWith({
      where: { organizationId: "org_1", user: { email: "new@example.com" } },
    });
  });

  it.each(["ESTIMATOR", "VIEWER"])("forbids %s", async (role) => {
    asRole(role);
    expect((await POST(req(ok))).status).toBe(403);
    expect(prisma.invitation.create).not.toHaveBeenCalled();
  });
});
