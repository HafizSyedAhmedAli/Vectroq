// @vitest-environment node
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

vi.mock("@vectroq/db", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    session: { deleteMany: vi.fn() },
  },
}));
vi.mock("@/lib/auth/session", () => ({ createSession: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  clientIp: () => "2.2.2.2",
  rateLimit: vi.fn(),
  tooMany: () => new Response(JSON.stringify({ error: "slow" }), { status: 429 }),
}));

import { POST } from "./route";
import { prisma } from "@vectroq/db";
import { hashPassword } from "@/lib/auth/credentials";
import { createSession } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";

const req = (body: unknown) =>
  new Request("http://localhost/api/auth/login", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as any;

let hash: string;
beforeAll(async () => {
  hash = await hashPassword("correct horse 1");
});

const user = () => ({
  id: "u1",
  email: "a@b.co",
  passwordHash: hash,
  memberships: [{ organizationId: "org_1" }],
});

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (rateLimit as any).mockResolvedValue({ ok: true });
    (prisma.user.findUnique as any).mockResolvedValue(user());
  });

  it("logs in, creates a session and audits", async () => {
    const res = await POST(req({ email: "A@b.co", password: "correct horse 1" }));
    expect(res.status).toBe(200);
    expect(createSession).toHaveBeenCalledWith("u1", "org_1", true);
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      "LOGIN",
      "User",
      "u1",
      { ip: "2.2.2.2" },
    );
    expect(prisma.session.deleteMany).toHaveBeenCalled();
  });

  it("honours remember:false", async () => {
    await POST(req({ email: "a@b.co", password: "correct horse 1", remember: false }));
    expect(createSession).toHaveBeenCalledWith("u1", "org_1", false);
  });

  it("401s on a wrong password", async () => {
    const res = await POST(req({ email: "a@b.co", password: "wrong" }));
    expect(res.status).toBe(401);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("401s on an unknown email", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    const res = await POST(req({ email: "x@b.co", password: "whatever" }));
    expect(res.status).toBe(401);
  });

  it("401s when the user has no membership", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ ...user(), memberships: [] });
    const res = await POST(req({ email: "a@b.co", password: "correct horse 1" }));
    expect(res.status).toBe(401);
  });

  it("401s on a malformed body without looking anyone up", async () => {
    const res = await POST(req("not json"));
    expect(res.status).toBe(401);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("429s when the IP limit is hit", async () => {
    (rateLimit as any).mockResolvedValueOnce({ ok: false });
    expect((await POST(req({ email: "a@b.co", password: "x" }))).status).toBe(429);
  });

  it("429s when the per-account limit is hit", async () => {
    (rateLimit as any)
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false });
    expect((await POST(req({ email: "a@b.co", password: "x" }))).status).toBe(429);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
