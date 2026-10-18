// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const tx = {
  emailVerification: { updateMany: vi.fn(), deleteMany: vi.fn() },
  user: { update: vi.fn() },
};

vi.mock("@vectroq/db", () => ({
  prisma: {
    emailVerification: { findUnique: vi.fn() },
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  },
}));

import { prisma } from "@vectroq/db";

const req = (body: unknown) =>
  new Request("http://localhost/api/auth/verify-email", {
    method: "POST",
    body: JSON.stringify(body),
  }) as any;

const future = () => new Date(Date.now() + 60_000);

describe("POST /api/auth/verify-email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.emailVerification.updateMany.mockResolvedValue({ count: 1 });
  });

  it("410s for an unknown token", async () => {
    (prisma.emailVerification.findUnique as any).mockResolvedValue(null);
    expect((await POST(req({ token: "nope" }))).status).toBe(410);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("410s for an expired or already used token", async () => {
    (prisma.emailVerification.findUnique as any).mockResolvedValueOnce({
      id: "v1",
      userId: "u1",
      usedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });
    expect((await POST(req({ token: "t" }))).status).toBe(410);

    (prisma.emailVerification.findUnique as any).mockResolvedValueOnce({
      id: "v1",
      userId: "u1",
      usedAt: new Date(),
      expiresAt: future(),
    });
    expect((await POST(req({ token: "t" }))).status).toBe(410);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("410s when another request already claimed the token", async () => {
    (prisma.emailVerification.findUnique as any).mockResolvedValue({
      id: "v1",
      userId: "u1",
      usedAt: null,
      expiresAt: future(),
    });
    tx.emailVerification.updateMany.mockResolvedValue({ count: 0 });
    expect((await POST(req({ token: "t" }))).status).toBe(410);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("marks the user's email as verified", async () => {
    (prisma.emailVerification.findUnique as any).mockResolvedValue({
      id: "v1",
      userId: "u1",
      usedAt: null,
      expiresAt: future(),
    });
    const res = await POST(req({ token: "t" }));
    expect(res.status).toBe(200);
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { emailVerifiedAt: expect.any(Date) },
    });
  });
});
