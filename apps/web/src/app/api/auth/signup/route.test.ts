// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const pending: Array<() => Promise<void>> = [];
vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  after: (fn: () => Promise<void>) => {
    pending.push(fn);
  },
}));

const { KnownErr } = vi.hoisted(() => {
  class KnownErr extends Error {
    code: string;
    meta: any;
    constructor(code: string, meta: any) {
      super("known");
      this.code = code;
      this.meta = meta;
    }
  }
  return { KnownErr };
});
vi.mock("@vectroq/db", () => ({
  Prisma: { PrismaClientKnownRequestError: KnownErr },
  prisma: { $transaction: vi.fn() },
}));
vi.mock("@/lib/auth/session", () => ({ createSession: vi.fn() }));
vi.mock("@/lib/auth/email-verification", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue("sent"),
}));
vi.mock("@/lib/app-url", () => ({ appUrl: () => "https://app.test" }));
vi.mock("@/lib/rate-limit", () => ({
  clientIp: () => "3.3.3.3",
  rateLimit: vi.fn(),
  tooMany: () => new Response(JSON.stringify({ error: "slow" }), { status: 429 }),
}));

import { POST } from "./route";
import { prisma } from "@vectroq/db";
import { createSession } from "@/lib/auth/session";
import { sendVerificationEmail } from "@/lib/auth/email-verification";
import { rateLimit } from "@/lib/rate-limit";

const good = {
  name: "Ali",
  company: "Acme Builders",
  email: "Ali@Acme.co",
  password: "a long secure pass 1",
};
const req = (body: unknown) =>
  new Request("http://localhost/api/auth/signup", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as any;

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pending.length = 0;
    (rateLimit as any).mockResolvedValue({ ok: true });
    (prisma.$transaction as any).mockImplementation(async (fn: any) =>
      fn({
        user: { create: vi.fn().mockResolvedValue({ id: "u1", email: "ali@acme.co" }) },
        organization: { create: vi.fn().mockResolvedValue({ id: "o1", slug: "acme-builders" }) },
        membership: { create: vi.fn() },
      }),
    );
  });

  it("creates the account, starts a session and queues the email", async () => {
    const res = await POST(req(good));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ slug: "acme-builders" });
    expect(createSession).toHaveBeenCalledWith("u1", "o1");
    await pending.shift()!();
    expect(sendVerificationEmail).toHaveBeenCalled();
  });

  it("429s when rate limited", async () => {
    (rateLimit as any).mockResolvedValue({ ok: false });
    expect((await POST(req(good))).status).toBe(429);
  });

  it.each([
    ["missing name", { ...good, name: "" }],
    ["name too long", { ...good, name: "x".repeat(101) }],
    ["missing company", { ...good, company: "" }],
    ["bad email", { ...good, email: "nope" }],
    ["weak password", { ...good, password: "short" }],
    ["reserved/invalid slug", { ...good, slug: "a" }],
  ])("400s on %s", async (_n, body) => {
    const res = await POST(req(body));
    expect(res.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("400s on a malformed body", async () => {
    expect((await POST(req("not json"))).status).toBe(400);
  });

  it("409s on a duplicate email", async () => {
    (prisma.$transaction as any).mockRejectedValue(new KnownErr("P2002", { target: ["email"] }));
    const res = await POST(req(good));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/email/i);
  });

  it("409s on a duplicate slug", async () => {
    (prisma.$transaction as any).mockRejectedValue(new KnownErr("P2002", { target: ["slug"] }));
    const res = await POST(req(good));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/taken/i);
  });

  it("rethrows unexpected errors", async () => {
    (prisma.$transaction as any).mockRejectedValue(new Error("boom"));
    await expect(POST(req(good))).rejects.toThrow("boom");
  });

  it("does not fail signup when the email step throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    (sendVerificationEmail as any).mockRejectedValueOnce(new Error("smtp"));
    const res = await POST(req(good));
    expect(res.status).toBe(201);
    await expect(pending.shift()!()).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
