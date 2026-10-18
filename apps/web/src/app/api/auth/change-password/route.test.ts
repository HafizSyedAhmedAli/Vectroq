// @vitest-environment node
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { POST } from "./route";
import { hashPassword } from "@/lib/auth/credentials";
import { sha256 } from "@/lib/auth/tokens";

vi.mock("@vectroq/db", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    session: { deleteMany: vi.fn() },
    $transaction: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock("@/lib/auth/guard", () => ({
  guard: vi.fn().mockResolvedValue({
    ok: true,
    auth: {
      org: { id: "org_1", slug: "demo" },
      role: "VIEWER",
      user: { id: "u1", email: "t@t.co", name: "Test", emailVerified: true },
    },
  }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "tok" }) }),
}));
vi.mock("@/lib/auth/session", () => ({ SESSION_COOKIE: "vq_session" }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue(true) }));

import { prisma } from "@vectroq/db";
import { sendEmail } from "@/lib/email";

const req = (body: unknown) =>
  new Request("http://localhost/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify(body),
  }) as any;

let currentHash: string;
beforeAll(async () => {
  currentHash = await hashPassword("old password 1");
});

describe("POST /api/auth/change-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "u1",
      passwordHash: currentHash,
    });
  });

  it("400s on a weak new password and touches nothing", async () => {
    const res = await POST(
      req({ currentPassword: "old password 1", newPassword: "short" }),
    );
    expect(res.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("400s when the current password is wrong", async () => {
    const res = await POST(
      req({ currentPassword: "nope nope nope", newPassword: "brand new pw 2" }),
    );
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toMatch(/current password/i);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("400s when the new password equals the current one", async () => {
    const res = await POST(
      req({
        currentPassword: "old password 1",
        newPassword: "old password 1",
      }),
    );
    expect(res.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("saves a new hash, signs out other devices only, and emails the owner", async () => {
    const res = await POST(
      req({
        currentPassword: "old password 1",
        newPassword: "brand new pw 2",
      }),
    );
    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { passwordHash: expect.stringMatching(/^scrypt\$/) },
    });
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1", id: { not: sha256("tok") } },
    });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "t@t.co" }),
    );
  });
});
