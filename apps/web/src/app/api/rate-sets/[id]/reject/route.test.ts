// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@vectroq/db", () => ({
  prisma: { rateSet: { updateMany: vi.fn() } },
}));
vi.mock("@/lib/org", () => ({ getCurrentOrg: vi.fn() }));
vi.mock("@/lib/auth/guard", () => ({ guard: vi.fn() }));
import { prisma } from "@vectroq/db";
import { guard } from "@/lib/auth/guard";

const asRole = (role: string) =>
  (guard as any).mockImplementation(async (min: string) => {
    const rank: any = { VIEWER: 0, ESTIMATOR: 1, OWNER: 2 };
    return rank[role] >= rank[min]
      ? { ok: true, auth: { org: { id: "org_1" }, role, user: { id: "u1" } } }
      : { ok: false, res: Response.json({ error: "no" }, { status: 403 }) };
  });
const call = () =>
  POST(new Request("http://localhost/x", { method: "POST" }) as any, {
    params: Promise.resolve({ id: "rs1" }),
  });

describe("POST /api/rate-sets/[id]/reject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asRole("ESTIMATOR");
    (prisma.rateSet.updateMany as any).mockResolvedValue({ count: 1 });
  });

  it("rejects a DRAFT set scoped to the caller's org", async () => {
    const res = await call();
    expect(await res.json()).toEqual({ id: "rs1", status: "REJECTED" });
    expect(prisma.rateSet.updateMany).toHaveBeenCalledWith({
      where: { id: "rs1", organizationId: "org_1", status: "DRAFT" },
      data: { status: "REJECTED" },
    });
  });

  it("404s when nothing matches (wrong org or not a draft)", async () => {
    (prisma.rateSet.updateMany as any).mockResolvedValue({ count: 0 });
    expect((await call()).status).toBe(404);
  });

  it("allows OWNER", async () => {
    asRole("OWNER");
    expect((await call()).status).toBe(200);
  });

  it("forbids VIEWER", async () => {
    asRole("VIEWER");
    expect((await call()).status).toBe(403);
    expect(prisma.rateSet.updateMany).not.toHaveBeenCalled();
  });
});
