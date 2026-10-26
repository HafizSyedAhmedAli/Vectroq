// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/rate-sets", () => {
  class RateSetError extends Error {
    constructor(public code: "NOT_FOUND" | "NOT_DRAFT") {
      super(code);
    }
  }
  return { RateSetError, approveRateSet: vi.fn() };
});
vi.mock("@/lib/org", () => ({ getCurrentOrg: vi.fn() }));
vi.mock("@/lib/auth/guard", () => ({ guard: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
import { approveRateSet, RateSetError } from "@/lib/rate-sets";
import { guard } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";

const asRole = (role: string) =>
  (guard as any).mockImplementation(async (min: string) => {
    const rank: any = { VIEWER: 0, ESTIMATOR: 1, OWNER: 2 };
    return rank[role] >= rank[min]
      ? { ok: true, auth: { org: { id: "org_1" }, role, user: { id: "u1" } } }
      : { ok: false, res: Response.json({ error: "no" }, { status: 403 }) };
  });
const call = (body: unknown) =>
  POST(
    new Request("http://localhost/x", {
      method: "POST",
      body: JSON.stringify(body),
    }) as any,
    { params: Promise.resolve({ id: "rs1" }) },
  );
const items = [
  { itemType: "brick", unit: "1000nos", unitRate: 20000 },
  { itemType: "cement", unit: "bag", unitRate: 1400 },
  { itemType: "sand", unit: "cft", unitRate: 60 },
  { itemType: "steelMaterial", unit: "ton", unitRate: 260000 },
];

describe("POST /api/rate-sets/[id]/approve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asRole("ESTIMATOR");
    (approveRateSet as any).mockResolvedValue({ id: "rs1", status: "APPROVED" });
  });

  it("approves within the caller's org and audits it", async () => {
    const res = await call({ approvedBy: " Ali " });
    expect(res.status).toBe(200);
    expect(approveRateSet).toHaveBeenCalledWith("org_1", "rs1", "Ali", undefined);
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      "RATE_SET_APPROVED",
      "RateSet",
      "rs1",
      { approvedBy: "Ali", edited: false },
    );
  });

  it("passes validated edited items through", async () => {
    await call({ approvedBy: "Ali", items });
    const passed = (approveRateSet as any).mock.calls[0][3];
    expect(passed).toHaveLength(4);
    expect((audit as any).mock.calls[0][4].edited).toBe(true);
  });

  it("requires approvedBy", async () => {
    expect((await call({})).status).toBe(400);
    expect((await call({ approvedBy: "   " })).status).toBe(400);
    expect(approveRateSet).not.toHaveBeenCalled();
  });

  it("rejects invalid edited items", async () => {
    const res = await call({ approvedBy: "Ali", items: [{ itemType: "nope" }] });
    expect(res.status).toBe(400);
    expect(approveRateSet).not.toHaveBeenCalled();
  });

  it("maps NOT_FOUND to 404 (e.g. another org's set)", async () => {
    (approveRateSet as any).mockRejectedValue(new RateSetError("NOT_FOUND"));
    expect((await call({ approvedBy: "Ali" })).status).toBe(404);
  });

  it("maps NOT_DRAFT to 409", async () => {
    (approveRateSet as any).mockRejectedValue(new RateSetError("NOT_DRAFT"));
    expect((await call({ approvedBy: "Ali" })).status).toBe(409);
  });

  it("rethrows unexpected errors", async () => {
    (approveRateSet as any).mockRejectedValue(new Error("db down"));
    await expect(call({ approvedBy: "Ali" })).rejects.toThrow("db down");
  });

  it("forbids VIEWER", async () => {
    asRole("VIEWER");
    expect((await call({ approvedBy: "Ali" })).status).toBe(403);
    expect(approveRateSet).not.toHaveBeenCalled();
  });
});
