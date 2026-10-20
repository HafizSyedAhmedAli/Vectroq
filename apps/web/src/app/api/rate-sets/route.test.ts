// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@vectroq/db", () => ({
  prisma: { rateSet: { create: vi.fn() } },
}));
vi.mock("@/lib/auth/guard", () => ({
  guard: vi.fn().mockResolvedValue({
    ok: true,
    auth: { org: { id: "org_1" }, role: "OWNER", user: { id: "u1" } },
  }),
}));
import { prisma } from "@vectroq/db";

const core = [
  { itemType: "brick", unit: "1000nos", unitRate: 20000 },
  { itemType: "cement", unit: "bag", unitRate: 1400 },
  { itemType: "sand", unit: "cft", unitRate: 60 },
  { itemType: "steelMaterial", unit: "ton", unitRate: 260000 },
];
const req = (body: unknown) =>
  new Request("http://localhost/api/rate-sets", {
    method: "POST",
    body: JSON.stringify(body),
  }) as any;

describe("POST /api/rate-sets", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a DRAFT for the user's org with a canonical city", async () => {
    (prisma.rateSet.create as any).mockResolvedValue({ id: "rs1" });
    const res = await POST(
      req({ city: "benazirabad", category: "B", items: core }),
    );
    expect(res.status).toBe(201);
    expect(prisma.rateSet.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org_1",
        city: "Nawabshah",
        status: "DRAFT",
        origin: "manual",
      }),
    });
  });

  it("rejects an unknown city", async () => {
    const res = await POST(
      req({ city: "Atlantis", category: "B", items: core }),
    );
    expect(res.status).toBe(400);
    expect(prisma.rateSet.create).not.toHaveBeenCalled();
  });

  it("rejects a set missing a core material", async () => {
    const res = await POST(
      req({ city: "Karachi", category: "B", items: core.slice(0, 3) }),
    );
    expect((await res.json()).error).toMatch(/steelMaterial/);
    expect(prisma.rateSet.create).not.toHaveBeenCalled();
  });
});
