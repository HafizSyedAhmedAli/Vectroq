// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DELETE } from "./route";

vi.mock("@vectroq/db", () => ({
  prisma: { invitation: { deleteMany: vi.fn() } },
}));
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
  DELETE(new Request("http://localhost/x", { method: "DELETE" }) as any, {
    params: Promise.resolve({ id: "inv_9" }),
  });

describe("DELETE /api/team/invites/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asRole("OWNER");
  });

  it("revokes the invite scoped to the caller's org", async () => {
    const res = await call();
    expect(await res.json()).toEqual({ ok: true });
    expect(prisma.invitation.deleteMany).toHaveBeenCalledWith({
      where: { id: "inv_9", organizationId: "org_1" },
    });
  });

  it.each(["ESTIMATOR", "VIEWER"])("forbids %s", async (role) => {
    asRole(role);
    expect((await call()).status).toBe(403);
    expect(prisma.invitation.deleteMany).not.toHaveBeenCalled();
  });
});
