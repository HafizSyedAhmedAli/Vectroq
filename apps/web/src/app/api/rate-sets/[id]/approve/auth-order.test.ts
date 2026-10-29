// apps/web/src/app/api/rate-sets/[id]/approve/auth-order.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/rate-sets", () => ({
  RateSetError: class extends Error {},
  approveRateSet: vi.fn(),
}));
vi.mock("@/lib/auth/guard", () => ({ guard: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
import { approveRateSet } from "@/lib/rate-sets";
import { guard } from "@/lib/auth/guard";

const call = (body: unknown) =>
  POST(
    new Request("http://x", {
      method: "POST",
      body: JSON.stringify(body),
    }) as any,
    {
      params: Promise.resolve({ id: "rs1" }),
    },
  );

beforeEach(() => {
  vi.clearAllMocks();
  (guard as any).mockResolvedValue({
    ok: false,
    res: Response.json({ error: "no" }, { status: 403 }),
  });
});

describe("approve: authorisation comes before validation", () => {
  it.each([{}, { approvedBy: "" }, { approvedBy: "x", items: "junk" }])(
    "a viewer sending %j gets 403, not 400",
    async (body) => {
      expect((await call(body)).status).toBe(403);
      expect(approveRateSet).not.toHaveBeenCalled();
    },
  );

  it("signed-out users get 401", async () => {
    (guard as any).mockResolvedValue({
      ok: false,
      res: Response.json({ error: "Sign in required." }, { status: 401 }),
    });
    expect((await call({})).status).toBe(401);
  });
});
