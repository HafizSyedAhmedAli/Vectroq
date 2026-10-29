import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/org", () => ({ requirePage: vi.fn() }));
vi.mock("@/lib/billing/usage", () => ({
  getUsage: vi.fn().mockResolvedValue({ projectsThisMonth: 2, seatsUsed: 3 }),
}));
vi.mock("@/lib/billing/stripe", () => ({ billingEnabled: () => true }));
vi.mock("@/components/BillingPanel", () => ({
  BillingPanel: (p: unknown) => (
    <pre data-testid="panel">{JSON.stringify(p)}</pre>
  ),
}));

import { requirePage } from "@/lib/org";
import BillingPage from "./page";

const org = (o: Record<string, unknown> = {}) => ({
  id: "org_1",
  plan: "FREE",
  isDemo: false,
  stripeCustomerId: null,
  planRenewsAt: null,
  planCancelsAt: null,
  ...o,
});
const as = (o = {}) => (requirePage as any).mockResolvedValue({ org: org(o) });
const props = () => JSON.parse(screen.getByTestId("panel").textContent!);
const page = (status?: string) =>
  BillingPage({ searchParams: Promise.resolve({ status }) });

beforeEach(() => {
  vi.clearAllMocks();
  as();
});

describe("Billing page", () => {
  it("requires an owner", async () => {
    await page();
    expect(requirePage).toHaveBeenCalledWith("OWNER");
  });

  it("passes plan, usage and limits for the Free plan", async () => {
    render(await page());
    expect(props()).toMatchObject({
      currentPlan: "FREE",
      hasSubscription: false,
      billingEnabled: true,
      isDemo: false,
      flash: null,
      usage: { projects: 2, projectLimit: 3, seats: 3, seatLimit: 1 },
    });
  });

  it("describes each plan's features", async () => {
    render(await page());
    const [free, pro, business] = props().plans;
    expect(free.features).toEqual([
      "3 projects per month",
      "1 team member",
      "PDF carries a Vectroq footer",
    ]);
    expect(pro.features).toEqual([
      "Unlimited projects",
      "5 team members",
      "No Vectroq branding on PDFs",
    ]);
    expect(business.features[1]).toBe("Unlimited team members");
  });

  it("reports a subscription when there is a Stripe customer", async () => {
    as({ plan: "PRO", stripeCustomerId: "cus_1" });
    render(await page());
    expect(props()).toMatchObject({
      currentPlan: "PRO",
      hasSubscription: true,
    });
    expect(props().usage).toMatchObject({ projectLimit: null, seatLimit: 5 });
  });

  it("shows the renewal date", async () => {
    as({ plan: "PRO", planRenewsAt: new Date("2026-11-01T00:00:00Z") });
    render(await page());
    expect(screen.getByText(/Renews/)).toBeInTheDocument();
  });

  it("shows a cancellation notice instead of the renewal", async () => {
    as({
      plan: "PRO",
      planRenewsAt: new Date("2026-11-01T00:00:00Z"),
      planCancelsAt: new Date("2026-11-01T00:00:00Z"),
    });
    render(await page());
    expect(screen.getByText(/Cancelled\. Access ends/)).toBeInTheDocument();
    expect(screen.queryByText(/Renews/)).not.toBeInTheDocument();
  });

  it.each([
    ["success", "success"],
    ["cancelled", "cancelled"],
    ["bogus", null],
    [undefined, null],
  ])("flash %s -> %s", async (status, flash) => {
    render(await page(status));
    expect(props().flash).toBe(flash);
  });
});
