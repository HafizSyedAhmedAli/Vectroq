// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DELETE, POST } from "./route";

vi.mock("@vectroq/db", () => ({
  prisma: {
    project: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
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
const ctx = { params: Promise.resolve({ id: "p1" }) };
const post = (body?: unknown) =>
  POST(
    new Request("http://x", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body ?? {}),
    }) as any,
    ctx,
  );
const del = () =>
  DELETE(new Request("http://x", { method: "DELETE" }) as any, ctx);
const DAY = 86_400_000;

beforeEach(() => {
  vi.clearAllMocks();
  asRole("ESTIMATOR");
  (prisma.project.findFirst as any).mockResolvedValue({ id: "p1" });
});

describe("POST /api/projects/:id/share", () => {
  it("creates a 30-day link by default and returns the token", async () => {
    const res = await post({});
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(
      Math.abs(new Date(json.expiresAt).getTime() - (Date.now() + 30 * DAY)),
    ).toBeLessThan(5000);
    const arg = (prisma.project.update as any).mock.calls[0][0];
    expect(arg.where).toEqual({ id: "p1" });
    expect(arg.data.shareToken).toBe(json.token);
  });

  it.each([7, 30, 90])("accepts %i days", async (days) => {
    const json = await (await post({ days })).json();
    expect(
      Math.abs(new Date(json.expiresAt).getTime() - (Date.now() + days * DAY)),
    ).toBeLessThan(5000);
  });

  it.each([[{ days: 45 }], [{ days: "x" }], ["{nope"]])(
    "falls back to 30 days for %j",
    async (body) => {
      const json = await (await post(body)).json();
      expect(
        Math.abs(new Date(json.expiresAt).getTime() - (Date.now() + 30 * DAY)),
      ).toBeLessThan(5000);
    },
  );

  it("only finds projects in the caller's company, else 404", async () => {
    await post({});
    expect(prisma.project.findFirst).toHaveBeenCalledWith({
      where: { id: "p1", organizationId: "org_1" },
    });
    (prisma.project.findFirst as any).mockResolvedValue(null);
    const res = await post({});
    expect(res.status).toBe(404);
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it("every link is different", async () => {
    const a = (await (await post({})).json()).token;
    const b = (await (await post({})).json()).token;
    expect(a).not.toBe(b);
  });

  it("audits the creation", async () => {
    await post({ days: 7 });
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      "SHARE_CREATED",
      "Project",
      "p1",
      expect.objectContaining({ days: 7, expiresAt: expect.any(String) }),
    );
  });

  it("forbids viewers", async () => {
    asRole("VIEWER");
    expect((await post({})).status).toBe(403);
    expect(prisma.project.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/projects/:id/share", () => {
  it("clears the link, scoped to the company, and audits", async () => {
    const res = await del();
    expect(await res.json()).toEqual({ ok: true });
    expect(prisma.project.updateMany).toHaveBeenCalledWith({
      where: { id: "p1", organizationId: "org_1" },
      data: { shareToken: null, shareExpiresAt: null },
    });
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      "SHARE_REVOKED",
      "Project",
      "p1",
    );
  });

  it("forbids viewers", async () => {
    asRole("VIEWER");
    expect((await del()).status).toBe(403);
    expect(prisma.project.updateMany).not.toHaveBeenCalled();
  });
});
