// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@vectroq/db", () => ({
  prisma: {
    auditLog: { deleteMany: vi.fn() },
    rateLimit: { deleteMany: vi.fn() },
    session: { deleteMany: vi.fn() },
  },
}));
vi.mock("@/lib/demo", () => ({ cleanupExpiredDemos: vi.fn() }));

import { GET } from "./route";
import { prisma } from "@vectroq/db";
import { cleanupExpiredDemos } from "@/lib/demo";

const req = (auth?: string) =>
  new Request("http://localhost/api/cron/cleanup", {
    headers: auth ? { authorization: auth } : {},
  }) as any;

describe("GET /api/cron/cleanup", () => {
  const saved = process.env.CRON_SECRET;
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "s3cret";
    (prisma.auditLog.deleteMany as any).mockResolvedValue({ count: 3 });
    (prisma.rateLimit.deleteMany as any).mockResolvedValue({ count: 5 });
    (prisma.session.deleteMany as any).mockResolvedValue({ count: 7 });
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = saved;
  });

  it("401s when CRON_SECRET is not set", async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(req("Bearer undefined"))).status).toBe(401);
    expect(prisma.auditLog.deleteMany).not.toHaveBeenCalled();
  });

  it("401s without or with a wrong bearer token", async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer nope"))).status).toBe(401);
    expect(cleanupExpiredDemos).not.toHaveBeenCalled();
  });

  it("deletes expired rows and reports counts", async () => {
    const res = await GET(req("Bearer s3cret"));
    expect(await res.json()).toEqual({
      auditDeleted: 3,
      rateLimitsDeleted: 5,
      sessionsDeleted: 7,
    });
    expect(cleanupExpiredDemos).toHaveBeenCalledTimes(1);
  });

  it("keeps 12 months of audit logs", async () => {
    await GET(req("Bearer s3cret"));
    const cutoff: Date = (prisma.auditLog.deleteMany as any).mock.calls[0][0].where.createdAt.lt;
    const months = (Date.now() - cutoff.getTime()) / (30 * 24 * 3600 * 1000);
    expect(months).toBeGreaterThan(11.5);
    expect(months).toBeLessThan(12.5);
  });
});
