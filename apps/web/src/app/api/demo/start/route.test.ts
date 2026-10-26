// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@vectroq/db", () => ({
  prisma: { organization: { count: vi.fn() }, $transaction: vi.fn() },
}));
vi.mock("@/lib/auth/session", () => ({ createSession: vi.fn() }));
vi.mock("@/lib/demo", () => ({
  cleanupExpiredDemos: vi.fn(),
  DEMO_HOURS: 2,
  MAX_ACTIVE_DEMOS: 50,
}));
vi.mock("@/lib/sample-project", () => ({ createSampleProject: vi.fn() }));
vi.mock("@/lib/app-url", () => ({ appUrl: () => "https://app.test" }));
vi.mock("@/lib/client-ip", () => ({ clientIp: () => "4.4.4.4" }));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(),
  tooMany: () => new Response(JSON.stringify({ error: "slow" }), { status: 429 }),
}));

import { POST } from "./route";
import { prisma } from "@vectroq/db";
import { createSession } from "@/lib/auth/session";
import { cleanupExpiredDemos } from "@/lib/demo";
import { createSampleProject } from "@/lib/sample-project";
import { rateLimit } from "@/lib/rate-limit";

const req = () => new Request("http://localhost/api/demo/start", { method: "POST" }) as any;
let created: any;

describe("POST /api/demo/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (rateLimit as any).mockResolvedValue({ ok: true });
    (cleanupExpiredDemos as any).mockResolvedValue(undefined);
    (prisma.organization.count as any).mockResolvedValue(0);
    (prisma.$transaction as any).mockImplementation(async (fn: any) => {
      created = {
        user: vi.fn().mockResolvedValue({ id: "u1" }),
        org: vi.fn().mockResolvedValue({ id: "o1", slug: "demo-x" }),
        mem: vi.fn(),
      };
      return fn({
        user: { create: created.user },
        organization: { create: created.org },
        membership: { create: created.mem },
      });
    });
  });

  it("429s when rate limited", async () => {
    (rateLimit as any).mockResolvedValue({ ok: false });
    expect((await POST(req())).status).toBe(429);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("503s when too many demos are active", async () => {
    (prisma.organization.count as any).mockResolvedValue(50);
    expect((await POST(req())).status).toBe(503);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("creates a demo user, org and owner membership, then a session", async () => {
    const res = await POST(req());
    expect(await res.json()).toEqual({ ok: true });
    expect(created.user.mock.calls[0][0].data.email).toMatch(/^demo-[0-9a-f]{8}@demo\.invalid$/);
    expect(created.org.mock.calls[0][0].data).toMatchObject({ isDemo: true, name: "Demo Builders" });
    expect(created.mem.mock.calls[0][0].data.role).toBe("OWNER");
    expect(createSession).toHaveBeenCalledWith("u1", "o1", false);
    expect(createSampleProject).toHaveBeenCalledWith({ id: "o1", slug: "demo-x" }, "https://app.test");
  });

  it("sets the demo expiry from DEMO_HOURS", async () => {
    await POST(req());
    const exp: Date = created.org.mock.calls[0][0].data.demoExpiresAt;
    expect(exp.getTime() - Date.now()).toBeGreaterThan(2 * 3_600_000 - 5000);
    expect(exp.getTime() - Date.now()).toBeLessThanOrEqual(2 * 3_600_000);
  });

  it("still succeeds if cleanup fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    (cleanupExpiredDemos as any).mockRejectedValue(new Error("x"));
    expect((await POST(req())).status).toBe(200);
    spy.mockRestore();
  });

  it("still succeeds if the sample project fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    (createSampleProject as any).mockRejectedValue(new Error("x"));
    expect((await POST(req())).status).toBe(200);
    spy.mockRestore();
  });
});
