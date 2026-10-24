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
import { rateLimit } from "./rate-limit";

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
