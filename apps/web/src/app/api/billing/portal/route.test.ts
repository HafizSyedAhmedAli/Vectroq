// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const portalCreate = vi.fn();
vi.mock("@/lib/auth/guard", () => ({ guard: vi.fn() }));
vi.mock("@/lib/app-url", () => ({ appUrl: () => "https://app.test" }));
vi.mock("@/lib/billing/stripe", () => ({
  getStripe: () => ({ billingPortal: { sessions: { create: portalCreate } } }),
}));

import { POST } from "./route";
import { guard } from "@/lib/auth/guard";

const req = () => new Request("http://localhost/api/billing/portal", { method: "POST" }) as any;
const as = (org: any) => (guard as any).mockResolvedValue({ ok: true, auth: { org } });

describe("POST /api/billing/portal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    portalCreate.mockResolvedValue({ url: "https://stripe.test/portal" });
  });

  it("403s for non-owners (guard response passes through)", async () => {
    (guard as any).mockResolvedValue({
      ok: false,
      res: NextResponse.json({ error: "no" }, { status: 403 }),
    });
    expect((await POST(req())).status).toBe(403);
    expect(guard).toHaveBeenCalledWith("OWNER");
  });

  it("400s when the org has no Stripe customer", async () => {
    as({ stripeCustomerId: null });
    expect((await POST(req())).status).toBe(400);
    expect(portalCreate).not.toHaveBeenCalled();
  });

  it("returns the portal url", async () => {
    as({ stripeCustomerId: "cus_1" });
    const res = await POST(req());
    expect(await res.json()).toEqual({ url: "https://stripe.test/portal" });
    expect(portalCreate).toHaveBeenCalledWith({
      customer: "cus_1",
      return_url: "https://app.test/office/billing",
    });
  });
});
