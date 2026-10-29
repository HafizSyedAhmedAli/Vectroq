import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/org", () => ({ requirePage: vi.fn() }));
vi.mock("@/lib/onboarding", () => ({ getOnboardingSteps: vi.fn() }));
vi.mock("@/components/OnboardingChecklist", () => ({
  OnboardingChecklist: (p: any) => <div data-testid="checklist" data-sample={String(p.canLoadSample)} />,
}));
vi.mock("@vectroq/db", () => ({
  prisma: {
    project: { findMany: vi.fn() },
    lead: { count: vi.fn() },
    rateSet: { count: vi.fn() },
  },
}));

import { prisma } from "@vectroq/db";
import { requirePage } from "@/lib/org";
import { getOnboardingSteps } from "@/lib/onboarding";
import DashboardPage from "./page";

const org = { id: "org_1", slug: "acme", name: "Acme" };
const as = (role = "OWNER") =>
  (requirePage as any).mockResolvedValue({ org, user: { name: "Sara Khan" }, role });
const proj = (id: string, status: string, total?: number) => ({
  id,
  status,
  city: "Karachi",
  category: "B",
  createdAt: new Date("2026-10-01T00:00:00Z"),
  lead: { name: `Client ${id}` },
  cadFile: total ? { boq: { total } } : null,
});

beforeEach(() => {
  vi.clearAllMocks();
  as();
  (getOnboardingSteps as any).mockResolvedValue([{ id: "a", done: false }]);
  (prisma.project.findMany as any).mockResolvedValue([
    proj("p1", "FINALIZED", 1_000_000),
    proj("p2", "NEW"),
    proj("p3", "CAD_UPLOADED", 2_000_000),
  ]);
  (prisma.lead.count as any).mockResolvedValue(4);
  (prisma.rateSet.count as any).mockResolvedValue(7);
});

describe("Dashboard", () => {
  it("greets by first name", async () => {
    render(await DashboardPage());
    expect(screen.getByRole("heading", { name: "Welcome back, Sara" })).toBeInTheDocument();
    expect(screen.getByText(/what is happening at Acme/i)).toBeInTheDocument();
  });

  it("scopes every query to the company (rates also include the shared library)", async () => {
    render(await DashboardPage());
    expect((prisma.project.findMany as any).mock.calls[0][0].where).toEqual({ organizationId: "org_1" });
    expect(prisma.lead.count).toHaveBeenCalledWith({
      where: { organizationId: "org_1", projects: { none: {} } },
    });
    expect((prisma.rateSet.count as any).mock.calls[0][0].where).toEqual({
      OR: [{ organizationId: "org_1" }, { organizationId: null }],
      status: "APPROVED",
    });
  });

  it("shows the stats", async () => {
    render(await DashboardPage());
    expect(screen.getByText("Rs 30.0 lakh")).toBeInTheDocument();
    expect(screen.getByText("2 priced estimates")).toBeInTheDocument();
    expect(screen.getByText("1 finalized")).toBeInTheDocument();
    expect(screen.getByText("Follow up and create projects")).toBeInTheDocument();
    expect(screen.getByText("Used for every BOQ")).toBeInTheDocument();
  });

  it("lists recent projects with amounts", async () => {
    render(await DashboardPage());
    expect(screen.getByText("Client p1")).toBeInTheDocument();
    expect(screen.getByText("Rs 1,000,000")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /client p1/i })).toHaveAttribute("href", "/office/p1");
  });

  it("shows empty states with no projects", async () => {
    (prisma.project.findMany as any).mockResolvedValue([]);
    (prisma.lead.count as any).mockResolvedValue(0);
    (prisma.rateSet.count as any).mockResolvedValue(0);
    render(await DashboardPage());
    expect(screen.getByText("No projects yet")).toBeInTheDocument();
    expect(screen.getByText("Nothing to show yet.")).toBeInTheDocument();
    expect(screen.getByText("All caught up")).toBeInTheDocument();
    expect(screen.getByText("Import a rate schedule")).toBeInTheDocument();
  });

  it("shows the checklist only while a step is open", async () => {
    const { unmount } = render(await DashboardPage());
    expect(screen.getByTestId("checklist")).toBeInTheDocument();
    unmount();
    (getOnboardingSteps as any).mockResolvedValue([{ id: "a", done: true }]);
    render(await DashboardPage());
    expect(screen.queryByTestId("checklist")).not.toBeInTheDocument();
  });

  it.each([
    ["OWNER", "true"],
    ["ESTIMATOR", "true"],
    ["VIEWER", "false"],
  ])("%s -> canLoadSample=%s", async (role, expected) => {
    as(role);
    render(await DashboardPage());
    expect(screen.getByTestId("checklist")).toHaveAttribute("data-sample", expected);
  });

  it("links the client form to the company slug", async () => {
    render(await DashboardPage());
    expect(screen.getByRole("link", { name: /open your client form/i })).toHaveAttribute("href", "/c/acme");
  });
});