import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BillingPanel } from "./BillingPanel";

const fetchMock = vi.fn();
const res = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
const loc = { href: "http://localhost/office/billing" };

beforeEach(() => {
  fetchMock.mockReset();
  loc.href = "http://localhost/office/billing";
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("location", loc);
});
afterEach(() => vi.unstubAllGlobals());

const plans = [
  { id: "FREE" as const, name: "Free", price: "Rs 0", features: ["1 project"] },
  { id: "PRO" as const, name: "Pro", price: "Rs 5,000", features: ["Unlimited projects"] },
  { id: "BUSINESS" as const, name: "Business", price: "Rs 15,000", features: ["10 seats"] },
];

function setup(over: Partial<React.ComponentProps<typeof BillingPanel>> = {}) {
  return render(
    <BillingPanel
      currentPlan="FREE"
      hasSubscription={false}
      billingEnabled
      isDemo={false}
      flash={null}
      usage={{ projects: 1, projectLimit: 3, seats: 1, seatLimit: 1 }}
      plans={plans}
      {...over}
    />,
  );
}

describe("BillingPanel", () => {
  it("renders plans, features and marks the current plan", () => {
    setup();
    expect(screen.getByText("Rs 5,000")).toBeInTheDocument();
    expect(screen.getByText("Unlimited projects")).toBeInTheDocument();
    expect(screen.getByText("Current plan")).toBeInTheDocument();
  });

  it("shows usage meters, flagging a full one", () => {
    setup();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    const seats = screen.getByText("1 / 1");
    expect(seats.className).toContain("text-red-600");
  });

  it("shows unlimited limits", () => {
    setup({ usage: { projects: 4, projectLimit: null, seats: 2, seatLimit: null } });
    expect(screen.getAllByText(/\/ unlimited/)).toHaveLength(2);
  });

  it("shows flash messages", () => {
    const { unmount } = setup({ flash: "success" });
    expect(screen.getByRole("status")).toHaveTextContent("Payment received");
    unmount();
    setup({ flash: "cancelled" });
    expect(screen.getByText(/checkout was cancelled/i)).toBeInTheDocument();
  });

  it("starts checkout for an upgrade and redirects to Stripe", async () => {
    fetchMock.mockReturnValue(res({ url: "https://checkout.stripe.test/s" }));
    setup();
    await userEvent.setup().click(screen.getByRole("button", { name: "Upgrade to Pro" }));
    await waitFor(() => expect(loc.href).toBe("https://checkout.stripe.test/s"));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/billing/checkout");
    expect(JSON.parse(init.body)).toEqual({ plan: "PRO" });
  });

  it("shows the server error when checkout fails", async () => {
    fetchMock.mockReturnValue(res({ error: "Plan unavailable." }, 400));
    setup();
    await userEvent.setup().click(screen.getByRole("button", { name: "Upgrade to Business" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Plan unavailable.");
    expect(screen.getByRole("button", { name: "Upgrade to Business" })).toBeEnabled();
  });

  it("treats a response without a url as an error", async () => {
    fetchMock.mockReturnValue(res({}));
    setup();
    await userEvent.setup().click(screen.getByRole("button", { name: "Upgrade to Pro" }));
    expect(await screen.findByText("Something went wrong.")).toBeInTheDocument();
  });

  it("disables upgrades when billing is off or in demo", () => {
    const { unmount } = setup({ billingEnabled: false });
    expect(screen.getByRole("button", { name: "Upgrade to Pro" })).toBeDisabled();
    expect(screen.getByText(/stripe is not configured/i)).toBeInTheDocument();
    unmount();
    setup({ isDemo: true });
    expect(screen.getByRole("button", { name: "Upgrade to Pro" })).toBeDisabled();
    expect(screen.getByText(/disabled in the demo company/i)).toBeInTheDocument();
  });

  it("offers the portal to paying customers", async () => {
    fetchMock.mockReturnValue(res({ url: "https://portal.test" }));
    setup({ currentPlan: "PRO", hasSubscription: true });
    expect(screen.getByRole("button", { name: /downgrade in billing portal/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /change in billing portal/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /upgrade to/i })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /manage billing/i }));
    await waitFor(() => expect(loc.href).toBe("https://portal.test"));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/billing/portal");
  });

  it("hides portal buttons for free users without a subscription", () => {
    setup();
    expect(screen.queryByRole("button", { name: /manage billing/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /downgrade/i })).not.toBeInTheDocument();
  });
});
