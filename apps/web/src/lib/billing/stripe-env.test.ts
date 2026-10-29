// apps/web/src/lib/billing/stripe-env.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("stripe", () => ({ default: class {} }));

const OLD = { ...process.env };
beforeEach(() => {
  vi.resetModules();
  delete process.env.STRIPE_PRICE_PRO;
  delete process.env.STRIPE_PRICE_BUSINESS;
});
afterEach(() => {
  process.env = { ...OLD };
});

describe("price ids are read when used, not when the module loads", () => {
  it("picks up a price set after import", async () => {
    const { PRICE_IDS, planForPrice } = await import("./stripe");
    expect(PRICE_IDS.PRO).toBeUndefined();
    expect(planForPrice("price_late")).toBeNull();

    process.env.STRIPE_PRICE_PRO = "price_late";
    expect(PRICE_IDS.PRO).toBe("price_late");
    expect(planForPrice("price_late")).toBe("PRO");
  });

  it("follows a price that changes", async () => {
    const { planForPrice } = await import("./stripe");
    process.env.STRIPE_PRICE_BUSINESS = "price_a";
    expect(planForPrice("price_a")).toBe("BUSINESS");
    process.env.STRIPE_PRICE_BUSINESS = "price_b";
    expect(planForPrice("price_a")).toBeNull();
    expect(planForPrice("price_b")).toBe("BUSINESS");
  });
});
