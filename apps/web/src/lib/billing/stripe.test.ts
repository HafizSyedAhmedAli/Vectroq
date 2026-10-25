import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ctor = vi.fn();
vi.mock("stripe", () => ({
  default: class { constructor(public key: string) { ctor(key); } },
}));

const OLD = { ...process.env };
beforeEach(() => { vi.resetModules(); ctor.mockClear(); });
afterEach(() => { process.env = { ...OLD }; });

describe("billing/stripe", () => {
  it("billingEnabled reflects STRIPE_SECRET_KEY", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect((await import("./stripe")).billingEnabled()).toBe(false);
    process.env.STRIPE_SECRET_KEY = "sk_test";
    expect((await import("./stripe")).billingEnabled()).toBe(true);
  });

  it("getStripe throws without a key", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const { getStripe } = await import("./stripe");
    expect(() => getStripe()).toThrow("STRIPE_SECRET_KEY is not set");
  });

  it("getStripe creates the client once and reuses it", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test";
    const { getStripe } = await import("./stripe");
    expect(getStripe()).toBe(getStripe());
    expect(ctor).toHaveBeenCalledTimes(1);
    expect(ctor).toHaveBeenCalledWith("sk_test");
  });

  it("planForPrice maps configured price ids to plans", async () => {
    process.env.STRIPE_PRICE_PRO = "price_pro";
    process.env.STRIPE_PRICE_BUSINESS = "price_biz";
    const { planForPrice, PRICE_IDS } = await import("./stripe");
    expect(PRICE_IDS).toEqual({ PRO: "price_pro", BUSINESS: "price_biz" });
    expect(planForPrice("price_pro")).toBe("PRO");
    expect(planForPrice("price_biz")).toBe("BUSINESS");
    expect(planForPrice("other")).toBeNull();
    expect(planForPrice(undefined)).toBeNull();
  });

  it("planForPrice never matches an unconfigured plan", async () => {
    delete process.env.STRIPE_PRICE_PRO; delete process.env.STRIPE_PRICE_BUSINESS;
    const { planForPrice } = await import("./stripe");
    expect(planForPrice("price_x")).toBeNull();
  });
});
