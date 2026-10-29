import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/org", () => ({
  getCurrentOrg: vi.fn().mockResolvedValue({ id: "org_1", rules: null }),
}));
vi.mock("@/components/BrandHero", () => ({ BrandHero: () => null }));
vi.mock("@/components/ConvertLeadForm", () => ({
  ConvertLeadForm: (p: unknown) => <pre data-testid="convert">{JSON.stringify(p)}</pre>,
}));
vi.mock("@vectroq/db", () => ({ prisma: { lead: { findMany: vi.fn() } } }));

import { prisma } from "@vectroq/db";
import OfficeLeadsPage from "./page";

const lead = (o: Record<string, unknown> = {}) => ({
  id: "l1",
  name: "Ali Raza",
  contact: "0300-1234567",
  city: "Hyderabad",
  model: 2,
  category: "B",
  source: "WHATSAPP",
  createdAt: new Date("2026-10-01T00:00:00Z"),
  planFileUrl: null,
  planFileName: null,
  ...o,
});

beforeEach(() => vi.clearAllMocks());

describe("Leads page", () => {
  it("lists only this company's unconverted leads, newest first", async () => {
    (prisma.lead.findMany as any).mockResolvedValue([]);
    render(await OfficeLeadsPage());
    expect(prisma.lead.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org_1", projects: { none: {} } },
      orderBy: { createdAt: "desc" },
    });
  });

  it("shows the empty state", async () => {
    (prisma.lead.findMany as any).mockResolvedValue([]);
    render(await OfficeLeadsPage());
    expect(screen.getByText("No leads waiting")).toBeInTheDocument();
    expect(screen.getByText(/0 leads/)).toBeInTheDocument();
  });

  it("shows a lead with its source label and passes defaults to the convert form", async () => {
    (prisma.lead.findMany as any).mockResolvedValue([lead()]);
    render(await OfficeLeadsPage());
    expect(screen.getByText("Ali Raza")).toBeInTheDocument();
    expect(screen.getByText(/WhatsApp/)).toBeInTheDocument();
    expect(screen.getByText(/1 lead — create a project/)).toBeInTheDocument();
    const form = JSON.parse(screen.getByTestId("convert").textContent!);
    expect(form).toMatchObject({
      leadId: "l1",
      defaultCity: "Hyderabad",
      defaultModel: 2,
      defaultCategory: "B",
    });
    expect(form.modelLabels["2"]).toBe("Construction on Client's Plot");
    expect(form.categoryLabels.B).toBe("Standard");
  });

  it("falls back to the raw source for unknown sources", async () => {
    (prisma.lead.findMany as any).mockResolvedValue([lead({ source: "SAMPLE" })]);
    render(await OfficeLeadsPage());
    expect(screen.getByText(/SAMPLE/)).toBeInTheDocument();
  });

  it("links the private plot plan download", async () => {
    (prisma.lead.findMany as any).mockResolvedValue([
      lead({ planFileUrl: "lead-plans/x.pdf", planFileName: "plan.pdf" }),
    ]);
    render(await OfficeLeadsPage());
    expect(screen.getByRole("link", { name: /download plot plan \(plan\.pdf\)/i })).toHaveAttribute(
      "href",
      "/api/leads/l1/plan",
    );
  });

  it("pluralises the count", async () => {
    (prisma.lead.findMany as any).mockResolvedValue([lead(), lead({ id: "l2" })]);
    render(await OfficeLeadsPage());
    expect(screen.getByText(/2 leads — create a project/)).toBeInTheDocument();
  });
});