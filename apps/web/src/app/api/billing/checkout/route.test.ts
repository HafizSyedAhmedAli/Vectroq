// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const { customersCreate, sessionsCreate, PRICE_IDS } = vi.hoisted(() => ({
  customersCreate: vi.fn(),
  sessionsCreate: vi.fn(),
  PRICE_IDS: { PRO: "price_pro", BUSINESS: "price_biz" } as Record<string, string | undefined>,
}));
vi.mock("@vectroq/db", () => ({ prisma: { organization: { update: vi.fn() } } }));
vi.mock("@/lib/auth/guard", () => ({ guard: vi.fn() }));
vi.mock("@/lib/app-url", () => ({ appUrl: () => "https://app.test" }));
vi.mock("@/lib/billing/stripe", () => ({
  PRICE_IDS,
  getStripe: () => ({
    customers: { create: customersCreate },
    checkout: { sessions: { create: sessionsCreate } },
  }),
}));

import { POST } from "./route";
import { guard } from "@/lib/auth/guard";
import { prisma } from "@vectroq/db";

const req = (body: unknown) =>
  new Request("http://localhost/api/billing/checkout", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as any;
const baseOrg = { id: "o1", name: "Acme", plan: "FREE", isDemo: false, stripeCustomerId: null, stripeSubscriptionId: null };
const as = (org: any = {}) =>
  (guard as any).mockResolvedValue({
    ok: true,
    auth: { org: { ...baseOrg, ...org }, user: { email: "o@acme.co" } },
  });

describe("POST /api/billing/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    PRICE_IDS.PRO = "price_pro";
    PRICE_IDS.BUSINESS = "price_biz";
    customersCreate.mockResolvedValue({ id: "cus_new" });
    sessionsCreate.mockResolvedValue({ url: "https://stripe.test/pay" });
    as();
  });

  it("passes through a guard failure", async () => {
    (guard as any).mockResolvedValue({
      ok: false,
      res: NextResponse.json({ error: "no" }, { status: 403 }),
    });
    expect((await POST(req({ plan: "PRO" }))).status).toBe(403);
  });

  it("403s for demo orgs", async () => {
    as({ isDemo: true });
    expect((await POST(req({ plan: "PRO" }))).status).toBe(403);
  });

  it.each([[{ plan: "FREE" }], [{}], ["not json"]])("400s on bad plan %j", async (b) => {
    expect((await POST(req(b))).status).toBe(400);
  });

  it("503s when the price is not configured", async () => {
    PRICE_IDS.PRO = undefined;
    expect((await POST(req({ plan: "PRO" }))).status).toBe(503);
  });

  it("409s when already subscribed", async () => {
    as({ plan: "PRO", stripeSubscriptionId: "sub_1" });
    expect((await POST(req({ plan: "BUSINESS" }))).status).toBe(409);
  });

  it("creates a customer, saves it and returns the checkout url", async () => {
    const res = await POST(req({ plan: "PRO" }));
    expect(await res.json()).toEqual({ url: "https://stripe.test/pay" });
    expect(customersCreate).toHaveBeenCalled();
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: { stripeCustomerId: "cus_new" },
    });
    expect(sessionsCreate.mock.calls[0][0]).toMatchObject({
      mode: "subscription",
      customer: "cus_new",
      line_items: [{ price: "price_pro", quantity: 1 }],
      client_reference_id: "o1",
    });
  });

  it("reuses an existing customer", async () => {
    as({ stripeCustomerId: "cus_old" });
    await POST(req({ plan: "BUSINESS" }));
    expect(customersCreate).not.toHaveBeenCalled();
    expect(prisma.organization.update).not.toHaveBeenCalled();
    expect(sessionsCreate.mock.calls[0][0]).toMatchObject({
      customer: "cus_old",
      line_items: [{ price: "price_biz", quantity: 1 }],
    });
  });

  it("allows a FREE org with a stale subscription id to upgrade", async () => {
    as({ plan: "FREE", stripeSubscriptionId: "sub_dead" });
    expect((await POST(req({ plan: "PRO" }))).status).toBe(200);
  });
});
