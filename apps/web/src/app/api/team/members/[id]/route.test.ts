// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH, DELETE } from "./route";

vi.mock("@vectroq/db", () => ({
  prisma: {
    membership: {
      findFirst: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    session: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/auth/guard", () => ({ guard: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
import { prisma } from "@vectroq/db";
import { guard } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";

const asRole = (role: string) =>
  (guard as any).mockImplementation(async (min: string) => {
    const rank: any = { VIEWER: 0, ESTIMATOR: 1, OWNER: 2 };
    return rank[role] >= rank[min]
      ? { ok: true, auth: { org: { id: "org_1" }, role, user: { id: "u1" } } }
      : { ok: false, res: Response.json({ error: "no" }, { status: 403 }) };
  });
const ctx = { params: Promise.resolve({ id: "m1" }) };
const patch = (body: unknown) =>
  PATCH(
    new Request("http://localhost/x", {
      method: "PATCH",
      body: JSON.stringify(body),
    }) as any,
    ctx,
  );
const del = () =>
  DELETE(new Request("http://localhost/x", { method: "DELETE" }) as any, ctx);

describe("PATCH /api/team/members/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asRole("OWNER");
    (prisma.membership.findFirst as any).mockResolvedValue({
      id: "m1",
      userId: "u2",
      role: "VIEWER",
    });
    (prisma.membership.count as any).mockResolvedValue(1);
  });

  it("changes a role, scoped to the org, and audits it", async () => {
    const res = await patch({ role: "ESTIMATOR" });
    expect(res.status).toBe(200);
    expect(prisma.membership.findFirst).toHaveBeenCalledWith({
      where: { id: "m1", organizationId: "org_1" },
    });
    expect(prisma.membership.update).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: { role: "ESTIMATOR" },
    });
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      "MEMBER_ROLE_CHANGED",
      "Membership",
      "m1",
      { role: "ESTIMATOR" },
    );
  });

  it("rejects an invalid role", async () => {
    expect((await patch({ role: "ROOT" })).status).toBe(400);
    expect(prisma.membership.update).not.toHaveBeenCalled();
  });

  it("404s for a member of another org (tenant isolation)", async () => {
    (prisma.membership.findFirst as any).mockResolvedValue(null);
    expect((await patch({ role: "VIEWER" })).status).toBe(404);
    expect(prisma.membership.update).not.toHaveBeenCalled();
  });

  it("blocks demoting the last owner", async () => {
    (prisma.membership.findFirst as any).mockResolvedValue({
      id: "m1",
      userId: "u1",
      role: "OWNER",
    });
    (prisma.membership.count as any).mockResolvedValue(0);
    expect((await patch({ role: "VIEWER" })).status).toBe(409);
    expect(prisma.membership.update).not.toHaveBeenCalled();
  });

  it("allows demoting an owner when another owner exists", async () => {
    (prisma.membership.findFirst as any).mockResolvedValue({
      id: "m1",
      userId: "u1",
      role: "OWNER",
    });
    expect((await patch({ role: "VIEWER" })).status).toBe(200);
  });

  it.each(["ESTIMATOR", "VIEWER"])("forbids %s", async (role) => {
    asRole(role);
    expect((await patch({ role: "VIEWER" })).status).toBe(403);
  });
});

describe("DELETE /api/team/members/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asRole("OWNER");
    (prisma.membership.findFirst as any).mockResolvedValue({
      id: "m1",
      userId: "u2",
      role: "ESTIMATOR",
    });
    (prisma.membership.count as any).mockResolvedValue(1);
    (prisma.$transaction as any).mockResolvedValue([]);
  });

  it("removes the member, kills their sessions in this org and audits", async () => {
    const res = await del();
    expect(res.status).toBe(200);
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u2", organizationId: "org_1" },
    });
    expect(prisma.membership.delete).toHaveBeenCalledWith({ where: { id: "m1" } });
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      "MEMBER_REMOVED",
      "Membership",
      "m1",
      { userId: "u2" },
    );
  });

  it("404s for another org's member", async () => {
    (prisma.membership.findFirst as any).mockResolvedValue(null);
    expect((await del()).status).toBe(404);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("blocks removing the last owner", async () => {
    (prisma.membership.findFirst as any).mockResolvedValue({
      id: "m1",
      userId: "u1",
      role: "OWNER",
    });
    (prisma.membership.count as any).mockResolvedValue(0);
    expect((await del()).status).toBe(409);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(["ESTIMATOR", "VIEWER"])("forbids %s", async (role) => {
    asRole(role);
    expect((await del()).status).toBe(403);
  });
});
