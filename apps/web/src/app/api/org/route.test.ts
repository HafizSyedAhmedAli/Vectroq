// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH } from "./route";

vi.mock("@vectroq/db", () => ({
  prisma: { organization: { update: vi.fn() } },
}));
vi.mock("@/lib/auth/guard", () => ({ guard: vi.fn() }));
vi.mock("@/lib/org", () => ({ getCurrentOrg: vi.fn() }));
import { prisma } from "@vectroq/db";
import { guard } from "@/lib/auth/guard";

const asRole = (role: string) =>
  (guard as any).mockImplementation(async (min: string) => {
    const rank: any = { VIEWER: 0, ESTIMATOR: 1, OWNER: 2 };
    return rank[role] >= rank[min]
      ? { ok: true, auth: { org: { id: "org_1" }, role, user: { id: "u1" } } }
      : { ok: false, res: Response.json({ error: "no" }, { status: 403 }) };
  });
const req = (body: unknown) =>
  new Request("http://localhost/api/org", {
    method: "PATCH",
    body: JSON.stringify(body),
  }) as any;
const valid = { name: "  Acme  ", primaryColor: "#2563EB", offices: [] };

describe("PATCH /api/org", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asRole("OWNER");
  });

  it("updates the caller's org with validated settings", async () => {
    (prisma.organization.update as any).mockResolvedValue({ id: "org_1" });
    const res = await PATCH(req(valid));
    expect(res.status).toBe(200);
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: "org_1" },
      data: expect.objectContaining({ name: "Acme", primaryColor: "#2563EB" }),
    });
  });

  it("clears the logo when removeLogo is true", async () => {
    const res = await PATCH(req({ removeLogo: true }));
    expect(await res.json()).toEqual({ ok: true });
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: "org_1" },
      data: { logoUrl: null },
    });
  });

  it("rejects an invalid colour", async () => {
    const res = await PATCH(req({ ...valid, primaryColor: "blue" }));
    expect(res.status).toBe(400);
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it("rejects an empty or malformed body", async () => {
    const res = await PATCH(
      new Request("http://localhost/api/org", {
        method: "PATCH",
        body: "not json",
      }) as any,
    );
    expect(res.status).toBe(400);
  });

  it.each(["ESTIMATOR", "VIEWER"])("forbids %s", async (role) => {
    asRole(role);
    const res = await PATCH(req(valid));
    expect(res.status).toBe(403);
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });
});
