// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const tx = {
  passwordReset: { updateMany: vi.fn(), deleteMany: vi.fn() },
  user: { update: vi.fn() },
  session: { deleteMany: vi.fn() },
};

vi.mock("@vectroq/db", () => ({
  prisma: {
    passwordReset: { findUnique: vi.fn() },
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  },
}));
// avoids needing AUTH_SECRET in tests
vi.mock("@/lib/auth/tokens", () => ({ sha256: (s: string) => `h:${s}` }));

import { prisma } from "@vectroq/db";

const req = (body: unknown) =>
  new Request("http://localhost/api/auth/reset", {
    method: "POST",
    body: JSON.stringify(body),
  }) as any;

const future = () => new Date(Date.now() + 60_000);

describe("POST /api/auth/reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.passwordReset.updateMany.mockResolvedValue({ count: 1 });
  });

  it("400s on a weak password and touches nothing", async () => {
    const res = await POST(req({ token: "t", password: "short" }));
    expect(res.status).toBe(400);
    expect(prisma.passwordReset.findUnique).not.toHaveBeenCalled();
  });

  it("410s for an unknown token", async () => {
    (prisma.passwordReset.findUnique as any).mockResolvedValue(null);
    const res = await POST(req({ token: "nope", password: "long enough pw" }));
    expect(res.status).toBe(410);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("410s for an expired or already used token", async () => {
    (prisma.passwordReset.findUnique as any).mockResolvedValueOnce({
      id: "r1",
      userId: "u1",
      usedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(
      (await POST(req({ token: "t", password: "long enough pw" }))).status,
    ).toBe(410);

    (prisma.passwordReset.findUnique as any).mockResolvedValueOnce({
      id: "r1",
      userId: "u1",
      usedAt: new Date(),
      expiresAt: future(),
    });
    expect(
      (await POST(req({ token: "t", password: "long enough pw" }))).status,
    ).toBe(410);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("410s when another request already claimed the token", async () => {
    (prisma.passwordReset.findUnique as any).mockResolvedValue({
      id: "r1",
      userId: "u1",
      usedAt: null,
      expiresAt: future(),
    });
    tx.passwordReset.updateMany.mockResolvedValue({ count: 0 });
    const res = await POST(req({ token: "t", password: "long enough pw" }));
    expect(res.status).toBe(410);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("sets a bcrypt hash and signs the user out everywhere", async () => {
    (prisma.passwordReset.findUnique as any).mockResolvedValue({
      id: "r1",
      userId: "u1",
      usedAt: null,
      expiresAt: future(),
    });
    const res = await POST(req({ token: "t", password: "long enough pw" }));
    expect(res.status).toBe(200);
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: {
        passwordHash: expect.stringMatching(/^[0-9a-f]{32}:[0-9a-f]{128}$/),
      },
    });
    expect(tx.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
    });
  });
});
