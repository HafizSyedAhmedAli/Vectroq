// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@vectroq/db", () => ({
  prisma: {
    invitation: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
    membership: { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/auth/session", () => ({ createSession: vi.fn() }));
vi.mock("@/lib/auth/credentials", () => ({
  hashPassword: vi.fn(async () => "HASH"),
  verifyPassword: vi.fn(),
  validatePassword: vi.fn(),
}));
import { prisma } from "@vectroq/db";
import { createSession } from "@/lib/auth/session";
import { hashPassword, verifyPassword, validatePassword } from "@/lib/auth/credentials";

const inv = {
  id: "i1",
  email: "a@b.com",
  role: "VIEWER",
  organizationId: "org_1",
  acceptedAt: null,
  expiresAt: new Date(Date.now() + 86_400_000),
};
const req = (body: unknown) =>
  new Request("http://localhost/x", {
    method: "POST",
    body: JSON.stringify(body),
  }) as any;

describe("POST /api/invites/accept", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (prisma.invitation.findUnique as any).mockResolvedValue(inv);
    (prisma.user.findUnique as any).mockResolvedValue(null);
    (prisma.user.create as any).mockResolvedValue({ id: "u_new" });
    (prisma.$transaction as any).mockResolvedValue([]);
    (validatePassword as any).mockReturnValue(null);
    (hashPassword as any).mockResolvedValue("HASH");
  });

  it("creates a new user, membership with the invited role, and a session", async () => {
    const res = await POST(req({ token: "t", name: " Sam ", password: "longpassword1" }));
    expect(res.status).toBe(200);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "a@b.com",
        name: "Sam",
        passwordHash: "HASH",
        emailVerifiedAt: expect.any(Date),
      }),
    });
    expect(prisma.membership.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { userId: "u_new", organizationId: "org_1", role: "VIEWER" },
      }),
    );
    expect(createSession).toHaveBeenCalledWith("u_new", "org_1");
  });

  it("lets an existing user join with their current password", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "u_old",
      passwordHash: "H",
    });
    (verifyPassword as any).mockResolvedValue(true);
    const res = await POST(req({ token: "t", password: "pw" }));
    expect(res.status).toBe(200);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(createSession).toHaveBeenCalledWith("u_old", "org_1");
  });

  it("rejects a wrong password for an existing user", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "u_old", passwordHash: "H" });
    (verifyPassword as any).mockResolvedValue(false);
    const res = await POST(req({ token: "t", password: "bad" }));
    expect(res.status).toBe(401);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("returns 410 for missing, unknown, used or expired tokens", async () => {
    expect((await POST(req({ password: "x" }))).status).toBe(410);
    (prisma.invitation.findUnique as any).mockResolvedValue(null);
    expect((await POST(req({ token: "t" }))).status).toBe(410);
    (prisma.invitation.findUnique as any).mockResolvedValue({ ...inv, acceptedAt: new Date() });
    expect((await POST(req({ token: "t" }))).status).toBe(410);
    (prisma.invitation.findUnique as any).mockResolvedValue({
      ...inv,
      expiresAt: new Date(Date.now() - 1000),
    });
    expect((await POST(req({ token: "t" }))).status).toBe(410);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("requires a name and a valid password for new users", async () => {
    expect((await POST(req({ token: "t", password: "p" }))).status).toBe(400);
    (validatePassword as any).mockReturnValue("Too short");
    const res = await POST(req({ token: "t", name: "Sam", password: "p" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Too short");
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
