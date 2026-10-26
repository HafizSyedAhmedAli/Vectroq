// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const pending: Array<() => Promise<void>> = [];
vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  after: (fn: () => Promise<void>) => {
    pending.push(fn);
  },
}));
vi.mock("@vectroq/db", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    passwordReset: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/app-url", () => ({ appUrl: () => "https://app.test" }));
vi.mock("@/lib/rate-limit", () => ({
  clientIp: () => "1.1.1.1",
  rateLimit: vi.fn(),
  tooMany: () => new Response(JSON.stringify({ error: "slow" }), { status: 429 }),
}));
vi.mock("@/lib/client-ip", () => ({ clientIp: () => "1.1.1.1" }));

import { POST } from "./route";
import { prisma } from "@vectroq/db";
import { sendEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

const req = (body: unknown) =>
  new Request("http://localhost/api/auth/forgot", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as any;
const flush = async () => {
  while (pending.length) await pending.shift()!();
};

describe("POST /api/auth/forgot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pending.length = 0;
    (rateLimit as any).mockResolvedValue({ ok: true });
    (prisma.user.findUnique as any).mockResolvedValue({ id: "u1", email: "a@b.co" });
    (prisma.passwordReset.findFirst as any).mockResolvedValue(null);
  });

  it("429s when rate limited", async () => {
    (rateLimit as any).mockResolvedValue({ ok: false });
    expect((await POST(req({ email: "a@b.co" }))).status).toBe(429);
  });

  it("400s on a missing or invalid email", async () => {
    expect((await POST(req({ email: "nope" }))).status).toBe(400);
    expect((await POST(req("not json"))).status).toBe(400);
  });

  it("emails a reset link for a known account", async () => {
    const res = await POST(req({ email: " A@B.co " }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    await flush();
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(JSON.stringify((sendEmail as any).mock.calls[0][0])).toContain(
      "https://app.test/reset-password/",
    );
  });

  it("replies the same for an unknown account and sends nothing", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    const res = await POST(req({ email: "ghost@b.co" }));
    expect(await res.json()).toEqual({ ok: true });
    await flush();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("skips sending during the one-minute cooldown", async () => {
    (prisma.passwordReset.findFirst as any).mockResolvedValue({ id: "r1" });
    await POST(req({ email: "a@b.co" }));
    await flush();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("swallows background errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    (prisma.user.findUnique as any).mockRejectedValue(new Error("db down"));
    const res = await POST(req({ email: "a@b.co" }));
    expect(res.status).toBe(200);
    await expect(flush()).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
