import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/org", () => ({
  requirePage: vi.fn().mockResolvedValue({ org: { id: "org_1", rules: null } }),
}));
vi.mock("@vectroq/db", () => ({
  prisma: {
    project: { findMany: vi.fn() },
    lead: { findMany: vi.fn() },
    rateSet: { findMany: vi.fn() },
  },
}));

import { prisma } from "@vectroq/db";
import SearchPage from "./page";

const page = (q?: string) =>
  SearchPage({ searchParams: Promise.resolve({ q }) });

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.project.findMany as any).mockResolvedValue([
    {
      id: "p1",
      city: "Karachi",
      category: "B",
      status: "CAD_UPLOADED",
      lead: { name: "Ali Khan" },
      cadFile: { boq: { total: 2_000_000 } },
    },
  ]);
  (prisma.lead.findMany as any).mockResolvedValue([
    {
      id: "l1",
      name: "Ali Raza",
      contact: "0300",
      city: "Lahore",
      createdAt: new Date("2026-10-01T00:00:00Z"),
      projects: [{ id: "p9" }],
    },
    {
      id: "l2",
      name: "Alina",
      contact: "0301",
      city: "Multan",
      createdAt: new Date("2026-10-01T00:00:00Z"),
      projects: [],
    },
  ]);
  (prisma.rateSet.findMany as any).mockResolvedValue([
    { city: "Karachi", category: "B", organizationId: "org_1" },
    { city: "Karachi", category: "A", organizationId: null },
    { city: "Lahore", category: "B", organizationId: null },
  ]);
});

describe("Search page", () => {
  it.each([undefined, "", "   "])(
    "asks for a query when q is %j",
    async (q) => {
      render(await page(q));
      expect(screen.getByText(/type a client name/i)).toBeInTheDocument();
      expect(prisma.project.findMany).not.toHaveBeenCalled();
    },
  );

  it("trims and caps the query, and scopes projects and leads to the company", async () => {
    render(await page("  ali  "));
    const has = (f: string) => ({
      [f]: { contains: "ali", mode: "insensitive" },
    });
    expect((prisma.project.findMany as any).mock.calls[0][0].where).toEqual({
      organizationId: "org_1",
      OR: [{ lead: has("name") }, { lead: has("contact") }, has("city")],
    });
    expect((prisma.lead.findMany as any).mock.calls[0][0].where).toEqual({
      organizationId: "org_1",
      OR: [has("name"), has("contact"), has("city")],
    });
    await page("x".repeat(300));
    expect(
      (prisma.lead.findMany as any).mock.calls[1][0].where.OR[0].name.contains,
    ).toHaveLength(100);
  });

  it("rate search includes the shared library but only approved sets", async () => {
    render(await page("kar"));
    const where = (prisma.rateSet.findMany as any).mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { organizationId: "org_1" },
      { organizationId: null },
    ]);
    expect(where.status).toBe("APPROVED");
    expect(where.city).toEqual({ contains: "kar", mode: "insensitive" });
  });

  it("shows results in three sections with the total", async () => {
    render(await page("ali"));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Results for “ali”",
    );
    expect(
      screen.getByText(/5 matches across projects, leads and rates/),
    ).toBeInTheDocument();
    expect(screen.getByText("Ali Khan")).toBeInTheDocument();
    expect(screen.getByText("CAD UPLOADED")).toBeInTheDocument();
    expect(screen.getByText("Rs 20.0 lakh")).toBeInTheDocument();
  });

  it("links a lead to its project, or to the leads list when it has none", async () => {
    render(await page("ali"));
    expect(screen.getByText("Has project")).toBeInTheDocument();
    expect(screen.getByText("Awaiting project")).toBeInTheDocument();
    expect(screen.getByText("Ali Raza").closest("a")).toHaveAttribute(
      "href",
      "/office/p9",
    );
    expect(screen.getByText("Alina").closest("a")).toHaveAttribute(
      "href",
      "/office/leads",
    );
  });

  it("groups rates by city, sorted categories, and labels own vs default", async () => {
    render(await page("ali"));
    const karachi = document.querySelector(
      'a[href="/office/rates?city=Karachi"]',
    )!;
    expect(karachi).toHaveTextContent("Categories A, B");
    expect(karachi).toHaveTextContent("Your rates");
    const lahore = document.querySelector(
      'a[href="/office/rates?city=Lahore"]',
    )!;
    expect(lahore).toHaveTextContent("Default rates");
  });

  it("shows 'No matches.' for empty sections", async () => {
    (prisma.project.findMany as any).mockResolvedValue([]);
    (prisma.lead.findMany as any).mockResolvedValue([]);
    (prisma.rateSet.findMany as any).mockResolvedValue([]);
    render(await page("zzz"));
    expect(screen.getAllByText("No matches.")).toHaveLength(3);
  });
});
