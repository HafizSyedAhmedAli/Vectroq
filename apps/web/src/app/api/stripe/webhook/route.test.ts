// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { constructEvent, retrieve } = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  retrieve: vi.fn(),
}));
vi.mock("@vectroq/db", () => ({ prisma: { organization: { updateMany: vi.fn() } } }));
vi.mock("@/lib/billing/stripe", () => ({
  getStripe: () => ({
    webhooks: { constructEvent },
    subscriptions: { retrieve },
  }),
  planForPrice: (id?: string) => (id === "price_pro" ? "PRO" : id === "price_biz" ? "BUSINESS" : null),
}));

import { POST } from "./route";
import { prisma } from "@vectroq/db";

const req = (headers: Record<string, string> = { "stripe-signature": "sig" }) =>
  new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers,
    body: "{}",
  }) as any;

const sub = (over: any = {}) => ({
  id: "sub_1",
  status: "active",
  customer: "cus_1",
  metadata: { organizationId: "o1" },
  cancel_at: null,
  cancel_at_period_end: false,
  items: { data: [{ price: { id: "price_pro" }, current_period_end: 1_800_000_000 }] },
  ...over,
});
const event = (type: string, object: any) => constructEvent.mockReturnValue({ type, data: { object } });

describe("POST /api/stripe/webhook", () => {
  const saved = process.env.STRIPE_WEBHOOK_SECRET;
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec";
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = saved;
  });

  it("400s when the secret is not configured", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect((await POST(req())).status).toBe(400);
  });

  it("400s without a signature header", async () => {
    expect((await POST(req({}))).status).toBe(400);
  });

  it("400s on a bad signature", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("bad");
    });
    expect((await POST(req())).status).toBe(400);
    expect(prisma.organization.updateMany).not.toHaveBeenCalled();
  });

  it("activates the plan on subscription.created", async () => {
    event("customer.subscription.created", sub());
    const res = await POST(req());
    expect(await res.json()).toEqual({ received: true });
    const arg = (prisma.organization.updateMany as any).mock.calls[0][0];
    expect(arg.where).toEqual({ id: "o1" });
    expect(arg.data).toMatchObject({
      plan: "PRO",
      planStatus: "active",
      stripeSubscriptionId: "sub_1",
      stripeCustomerId: "cus_1",
    });
    expect(arg.data.planRenewsAt).toEqual(new Date(1_800_000_000 * 1000));
    expect(arg.data.planCancelsAt).toBeNull();
  });

  it("maps the BUSINESS price", async () => {
    event("customer.subscription.updated", sub({ items: { data: [{ price: { id: "price_biz" } }] } }));
    await POST(req());
    expect((prisma.organization.updateMany as any).mock.calls[0][0].data.plan).toBe("BUSINESS");
  });

  it("records a pending cancellation at period end", async () => {
    event("customer.subscription.updated", sub({ cancel_at_period_end: true }));
    await POST(req());
    expect((prisma.organization.updateMany as any).mock.calls[0][0].data.planCancelsAt).toEqual(
      new Date(1_800_000_000 * 1000),
    );
  });

  it("downgrades to FREE on a deleted/canceled subscription", async () => {
    event("customer.subscription.deleted", sub({ status: "canceled" }));
    await POST(req());
    expect((prisma.organization.updateMany as any).mock.calls[0][0].data).toMatchObject({
      plan: "FREE",
      planStatus: "canceled",
      stripeSubscriptionId: null,
      planCancelsAt: null,
    });
  });

  it("downgrades to FREE for an unknown price", async () => {
    event("customer.subscription.updated", sub({ items: { data: [{ price: { id: "price_x" } }] } }));
    await POST(req());
    expect((prisma.organization.updateMany as any).mock.calls[0][0].data.plan).toBe("FREE");
  });

  it("finds the org by customer id when metadata is missing", async () => {
    event("customer.subscription.updated", sub({ metadata: {}, customer: { id: "cus_9" } }));
    await POST(req());
    expect((prisma.organization.updateMany as any).mock.calls[0][0].where).toEqual({
      stripeCustomerId: "cus_9",
    });
  });

  it("retrieves the subscription on checkout.session.completed", async () => {
    event("checkout.session.completed", { subscription: "sub_1" });
    retrieve.mockResolvedValue(sub());
    await POST(req());
    expect(retrieve).toHaveBeenCalledWith("sub_1");
    expect(prisma.organization.updateMany).toHaveBeenCalled();
  });

  it("ignores checkout sessions without a subscription", async () => {
    event("checkout.session.completed", { subscription: null });
    await POST(req());
    expect(retrieve).not.toHaveBeenCalled();
    expect(prisma.organization.updateMany).not.toHaveBeenCalled();
  });

  it("acknowledges unrelated events without touching the DB", async () => {
    event("invoice.paid", {});
    expect((await POST(req())).status).toBe(200);
    expect(prisma.organization.updateMany).not.toHaveBeenCalled();
  });
});
