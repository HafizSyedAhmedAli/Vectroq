// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@vectroq/db", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    rateLimit: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
  },
  Prisma: { sql: (s: TemplateStringsArray, ...v: unknown[]) => ({ s, v }) },
}));

import { prisma } from "@vectroq/db";
import { rateLimit, tooMany, clientIp } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows requests up to the limit", async () => {
    (prisma.$queryRaw as any).mockResolvedValue([{ count: 5, retry: 100 }]);
    expect(await rateLimit("k", 5, 600)).toMatchObject({
      ok: true,
      remaining: 0,
    });
  });

  it("blocks over the limit and reports when to retry", async () => {
    (prisma.$queryRaw as any).mockResolvedValue([{ count: 6, retry: 42 }]);
    expect(await rateLimit("k", 5, 600)).toMatchObject({
      ok: false,
      retryAfterSec: 42,
    });
  });

  it("fails open if the database errors", async () => {
    (prisma.$queryRaw as any).mockRejectedValue(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await rateLimit("k", 5, 600)).ok).toBe(true);
    spy.mockRestore();
  });
});

describe("rateLimit fallbacks and helpers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("housekeeping deletes expired rows ~1% of the time", async () => {
    (prisma.$queryRaw as any).mockResolvedValue([{ count: 1, retry: 10 }]);
    const r = vi.spyOn(Math, "random").mockReturnValue(0);
    await rateLimit("k", 5, 60);
    expect(prisma.rateLimit.deleteMany).toHaveBeenCalled();
    r.mockReturnValue(0.5);
    (prisma.rateLimit.deleteMany as any).mockClear();
    await rateLimit("k", 5, 60);
    expect(prisma.rateLimit.deleteMany).not.toHaveBeenCalled();
    r.mockRestore();
  });

  it("clamps retryAfterSec to at least 1", async () => {
    (prisma.$queryRaw as any).mockResolvedValue([{ count: 9, retry: 0 }]);
    expect((await rateLimit("k", 5, 60)).retryAfterSec).toBe(1);
  });

  it("in-memory fallback enforces the limit and resets after the window", async () => {
    (prisma.$queryRaw as any).mockRejectedValue(new Error("down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers();
    const key = "mem-" + Math.random();
    expect((await rateLimit(key, 2, 60)).ok).toBe(true);
    expect((await rateLimit(key, 2, 60)).remaining).toBe(0);
    const blocked = await rateLimit(key, 2, 60);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(1);
    vi.advanceTimersByTime(61_000);
    expect((await rateLimit(key, 2, 60)).ok).toBe(true);
    vi.useRealTimers();
    spy.mockRestore();
  });

  it("in-memory fallback purges expired entries when the map is large", async () => {
    (prisma.$queryRaw as any).mockRejectedValue(new Error("down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers();
    for (let i = 0; i < 5001; i++) await rateLimit(`bulk-${i}`, 1, 1);
    vi.advanceTimersByTime(2000);
    expect((await rateLimit("after-purge", 1, 60)).ok).toBe(true);
    vi.useRealTimers();
    spy.mockRestore();
  });

  it("tooMany returns 429 with Retry-After and pluralised minutes", async () => {
    const res = tooMany({ ok: false, remaining: 0, retryAfterSec: 61 });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("61");
    expect((await res.json()).error).toBe("Too many attempts. Try again in 2 minutes.");
    const one = tooMany({ ok: false, remaining: 0, retryAfterSec: 30 });
    expect((await one.json()).error).toContain("1 minute.");
    const custom = tooMany({ ok: false, remaining: 0, retryAfterSec: 5 }, "Slow down");
    expect((await custom.json()).error).toBe("Slow down");
  });

  it("clientIp prefers x-forwarded-for, then x-real-ip, then unknown", () => {
    const h = (o: Record<string, string>) => new Request("http://x", { headers: o });
    expect(clientIp(h({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientIp(h({ "x-real-ip": "3.3.3.3" }))).toBe("3.3.3.3");
    expect(clientIp(h({}))).toBe("unknown");
  });
});
