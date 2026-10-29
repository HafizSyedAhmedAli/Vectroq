import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/org", () => ({
  getCurrentOrg: vi.fn().mockResolvedValue({ id: "org_1", rules: null }),
}));
vi.mock("@/components/BrandHero", () => ({ BrandHero: () => null }));
vi.mock("@/components/RateSetReviewPanel", () => ({
  RateSetReviewPanel: (p: unknown) => (
    <pre data-testid="panel">{JSON.stringify(p)}</pre>
  ),
}));
vi.mock("@vectroq/db", () => ({ prisma: { rateSet: { findMany: vi.fn() } } }));

import { prisma } from "@vectroq/db";
import OfficeRatesPage from "./page";

const row = (
  id: string,
  city: string,
  category: string,
  organizationId: string | null,
  over = {},
) => ({
  id,
  city,
  category,
  origin: "csr",
  organizationId,
  approvedBy: "Ali",
  approvedAt: new Date("2026-10-01T00:00:00Z"),
  createdAt: new Date("2026-10-02T00:00:00Z"),
  items: [],
  sources: null,
  ...over,
});

let drafts: any[] = [];
let own: any[] = [];
let shared: any[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  drafts = [];
  own = [];
  shared = [];
  (prisma.rateSet.findMany as any).mockImplementation(
    async ({ where }: any) => {
      if (where.status === "DRAFT") return drafts;
      return where.organizationId === null ? shared : own;
    },
  );
});

const props = () => JSON.parse(screen.getByTestId("panel").textContent!);
const page = (city?: string) =>
  OfficeRatesPage({ searchParams: Promise.resolve({ city }) });

describe("Rates page", () => {
  it("loads drafts and approved sets for the company, plus the shared library", async () => {
    render(await page());
    const wheres = (prisma.rateSet.findMany as any).mock.calls.map(
      (c: any) => c[0].where,
    );
    expect(wheres).toContainEqual({ organizationId: "org_1", status: "DRAFT" });
    expect(wheres).toContainEqual({
      organizationId: "org_1",
      status: "APPROVED",
    });
    expect(wheres).toContainEqual({ organizationId: null, status: "APPROVED" });
  });

  it("hides a shared default once the company has its own for that city and category", async () => {
    own = [row("o1", "Karachi", "B", "org_1")];
    shared = [
      row("s1", "karachi", "B", null),
      row("s2", "Karachi", "A", null),
      row("s3", "Lahore", "B", null),
    ];
    render(await page());
    const ids = props().approved.map((a: any) => a.id);
    expect(ids).toEqual(["o1", "s2", "s3"]);
    expect(props().approved.find((a: any) => a.id === "s2").isDefault).toBe(
      true,
    );
    expect(props().approved.find((a: any) => a.id === "o1").isDefault).toBe(
      false,
    );
  });

  it("formats dates on the server and handles missing ones", async () => {
    own = [
      row("o1", "Karachi", "B", "org_1", {
        approvedAt: null,
        approvedBy: null,
      }),
    ];
    render(await page());
    expect(props().approved[0]).toMatchObject({
      approvedBy: "—",
      approvedLabel: "—",
      approvedAt: null,
    });
  });

  it("maps drafts and passes the initial city and category labels", async () => {
    drafts = [row("d1", "Multan", "C", "org_1")];
    render(await page("Multan"));
    expect(props().initialCity).toBe("Multan");
    expect(props().initialDrafts[0]).toMatchObject({
      id: "d1",
      city: "Multan",
    });
    expect(props().initialDrafts[0].createdAt).toBe("2026-10-02T00:00:00.000Z");
    expect(props().categoryLabels).toEqual({
      A: "Premium",
      B: "Standard",
      C: "Economy",
    });
  });

  it("defaults the initial city to empty", async () => {
    render(await page());
    expect(props().initialCity).toBe("");
  });

  it("counts approved sets in the header", async () => {
    own = [row("o1", "Karachi", "B", "org_1")];
    shared = [row("s1", "Lahore", "B", null)];
    render(await page());
    expect(screen.getByText(/2 approved sets/)).toBeInTheDocument();
  });

  it("uses the singular for one set", async () => {
    own = [row("o1", "Karachi", "B", "org_1")];
    render(await page());
    expect(screen.getByText(/1 approved set$/)).toBeInTheDocument();
  });
});
