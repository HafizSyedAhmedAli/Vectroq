// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PATCH } from "./route";

vi.mock("@vectroq/db", async () => {
  return {
    Prisma: { JsonNull: "JSON_NULL" },
    prisma: { organization: { update: vi.fn() } },
  };
});
vi.mock("@/lib/auth/guard", () => ({ guard: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
import { DEFAULT_ORG_RULES } from "@vectroq/shared-types";
import { prisma } from "@vectroq/db";
import { guard } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";

const asRole = (role: string, rules: unknown = null) =>
  (guard as any).mockImplementation(async (min: string) => {
    const rank: any = { VIEWER: 0, ESTIMATOR: 1, OWNER: 2 };
    return rank[role] >= rank[min]
      ? {
          ok: true,
          auth: { org: { id: "org_1", rules }, role, user: { id: "u1" } },
        }
      : { ok: false, res: Response.json({ error: "no" }, { status: 403 }) };
  });
const req = (body: unknown) =>
  new Request("http://localhost/api/org/rules", {
    method: "PATCH",
    body: JSON.stringify(body),
  }) as any;

describe("/api/org/rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asRole("OWNER");
  });

  it("GET returns the default rules when none are stored (any role)", async () => {
    asRole("VIEWER");
    const res = await GET();
    expect((await res.json()).rules).toEqual(DEFAULT_ORG_RULES);
  });

  it("PATCH reset clears stored rules and returns defaults", async () => {
    const res = await PATCH(req({ reset: true }));
    expect((await res.json()).rules).toEqual(DEFAULT_ORG_RULES);
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: "org_1" },
      data: { rules: "JSON_NULL" },
    });
  });

  it("PATCH saves valid rules and audits it", async () => {
    const res = await PATCH(req(DEFAULT_ORG_RULES));
    if (res.status === 200) {
      expect(prisma.organization.update).toHaveBeenCalledTimes(1);
      expect(audit).toHaveBeenCalledWith(
        expect.anything(),
        "RULES_UPDATED",
        "Organization",
        "org_1",
        { reset: false },
      );
    } else {
      throw new Error("defaults should validate, got " + res.status);
    }
  });

  it("PATCH rejects invalid rules", async () => {
    const res = await PATCH(req({ nonsense: true }));
    expect(res.status).toBe(400);
    expect(prisma.organization.update).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it.each(["ESTIMATOR", "VIEWER"])("PATCH forbids %s", async (role) => {
    asRole(role);
    expect((await PATCH(req({ reset: true }))).status).toBe(403);
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });
});
