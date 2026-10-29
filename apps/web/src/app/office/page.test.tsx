import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/org", () => ({
  getCurrentOrg: vi.fn().mockResolvedValue({ id: "org_1", rules: null }),
}));
vi.mock("@/components/BrandHero", () => ({ BrandHero: () => null }));
vi.mock("@/components/ProjectsList", () => ({
  ProjectsList: (p: unknown) => <pre data-testid="list">{JSON.stringify(p)}</pre>,
}));
vi.mock("@vectroq/db", () => ({
  prisma: { project: { findMany: vi.fn() }, lead: { count: vi.fn() } },
}));

import { prisma } from "@vectroq/db";
import OfficeProjectsPage from "./page";

const project = (o: Record<string, unknown> = {}) => ({
  id: "p1",
  city: "Karachi",
  model: 2,
  category: "B",
  status: "FINALIZED",
  createdAt: new Date("2026-10-01T00:00:00Z"),
  lead: { name: "Ali Khan" },
  render: null,
  cadFile: { boq: { total: 1500000 } },
  ...o,
});
const props = () => JSON.parse(screen.getByTestId("list").textContent!);
const page = (q?: string) => OfficeProjectsPage({ searchParams: Promise.resolve({ q }) });

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.project.findMany as any).mockResolvedValue([project()]);
  (prisma.lead.count as any).mockResolvedValue(3);
});

describe("Projects page", () => {
  it("only loads this company's projects and pending leads", async () => {
    render(await page());
    expect((prisma.project.findMany as any).mock.calls[0][0].where).toEqual({ organizationId: "org_1" });
    expect(prisma.lead.count).toHaveBeenCalledWith({
      where: { organizationId: "org_1", projects: { none: {} } },
    });
  });

  it("turns projects into plain card data", async () => {
    render(await page("ali"));
    const p = props();
    expect(p.initialQuery).toBe("ali");
    expect(p.projects[0]).toMatchObject({
      id: "p1",
      name: "Ali Khan",
      modelLabel: "Construction on Client's Plot",
      categoryLabel: "Category B · Standard",
      hasRender: false,
      imageUrl: "/demo.jpg",
      valueLabel: "Rs 1,500,000",
    });
  });

  it("uses the render image and no value when there is no BOQ", async () => {
    (prisma.project.findMany as any).mockResolvedValue([
      project({ render: { imageUrl: "/renders/p.png" }, cadFile: null }),
    ]);
    render(await page());
    expect(props().projects[0]).toMatchObject({
      hasRender: true,
      imageUrl: "/renders/p.png",
      valueLabel: null,
    });
  });

  it("shows the pending-lead link with correct plural", async () => {
    render(await page());
    expect(screen.getByRole("link", { name: /3 leads\s*awaiting a project/i })).toHaveAttribute(
      "href",
      "/office/leads",
    );
  });

  it("uses the singular for one lead", async () => {
    (prisma.lead.count as any).mockResolvedValue(1);
    render(await page());
    expect(screen.getByRole("link", { name: /1 lead\s*awaiting a project/i })).toBeInTheDocument();
  });
});