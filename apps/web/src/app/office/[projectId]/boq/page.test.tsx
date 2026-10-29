import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { DEFAULT_EXCLUSIONS } from "@vectroq/shared-types";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/org", () => ({ getCurrentOrg: vi.fn() }));
vi.mock("@/components/BoqTable", () => ({
  BoqTable: () => <div>boq-table</div>,
}));
vi.mock("@/components/BrandLogo", () => ({ BrandLogo: () => null }));
vi.mock("@/components/DownloadPdfButton", () => ({
  DownloadPdfButton: ({ href }: { href: string }) => (
    <a href={href}>download</a>
  ),
}));
vi.mock("@vectroq/db", () => ({ prisma: { project: { findFirst: vi.fn() } } }));

import { prisma } from "@vectroq/db";
import { getCurrentOrg } from "@/lib/org";
import BoqPrintPage from "./page";

const org = {
  id: "org_1",
  name: "Acme",
  tagline: null,
  logoUrl: null,
  primaryColor: "#2563EB",
  phone: "0300",
  email: "a@acme.co",
  website: null,
  offices: [{ title: "HQ", address: "Karachi" }],
  rules: null,
};
const project = (o: Record<string, unknown> = {}) => ({
  id: "p1",
  city: "Karachi",
  model: 2,
  category: "B",
  lead: { name: "Ali Khan", contact: "0300-1" },
  cadFile: {
    boq: { total: 1_500_000, subtotal: 1, tax: 0, lineItems: [] },
    geometry: { walls: [], openings: [], rooms: [{ area: 100 }, { area: 50 }] },
  },
  ...o,
});
const page = () =>
  BoqPrintPage({ params: Promise.resolve({ projectId: "p1" }) });

beforeEach(() => {
  vi.clearAllMocks();
  (getCurrentOrg as any).mockResolvedValue(org);
  (prisma.project.findFirst as any).mockResolvedValue(project());
});

describe("Printable BOQ page", () => {
  it("404s for a project outside the company", async () => {
    (prisma.project.findFirst as any).mockResolvedValue(null);
    await expect(page()).rejects.toThrow("NOT_FOUND");
    expect((prisma.project.findFirst as any).mock.calls[0][0].where).toEqual({
      id: "p1",
      organizationId: "org_1",
    });
  });

  it("explains when no BOQ has been calculated and links back", async () => {
    (prisma.project.findFirst as any).mockResolvedValue(
      project({ cadFile: { boq: null } }),
    );
    render(await page());
    expect(screen.getByText(/no boq has been calculated/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to project/i }),
    ).toHaveAttribute("href", "/office/p1");
  });

  it("explains when there is no drawing at all", async () => {
    (prisma.project.findFirst as any).mockResolvedValue(
      project({ cadFile: null }),
    );
    render(await page());
    expect(screen.getByText(/no boq has been calculated/i)).toBeInTheDocument();
  });

  it("renders the client, engagement, category and area", async () => {
    render(await page());
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /bill of quantities & cost estimate/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ali Khan")).toBeInTheDocument();
    expect(screen.getByText("0300-1")).toBeInTheDocument();
    expect(
      screen.getByText(/Model 2 — Construction on Client's Plot/),
    ).toBeInTheDocument();
    expect(screen.getByText("Category B · Standard")).toBeInTheDocument();
    expect(screen.getByText("150 sq ft")).toBeInTheDocument();
  });

  it("computes the per-sq-ft figure from the total and covered area", async () => {
    render(await page());
    expect(
      screen.getByText(/Approx\. Rs 10,000 per sq ft/),
    ).toBeInTheDocument();
  });

  it("does not divide by zero when there are no rooms", async () => {
    (prisma.project.findFirst as any).mockResolvedValue(
      project({
        cadFile: {
          boq: { total: 500 },
          geometry: { walls: [], rooms: [], openings: [] },
        },
      }),
    );
    render(await page());
    expect(screen.getByText(/Approx\. Rs 500 per sq ft/)).toBeInTheDocument();
  });

  it("shows the company's offices, the notes and the signature block", async () => {
    render(await page());
    expect(screen.getByText("HQ: Karachi")).toBeInTheDocument();
    expect(screen.getByText(DEFAULT_EXCLUSIONS[0])).toBeInTheDocument();
    expect(screen.getByText("For Acme")).toBeInTheDocument();
    expect(screen.getByText("Client acceptance")).toBeInTheDocument();
    expect(screen.getByText("boq-table")).toBeInTheDocument();
  });

  it("points the download button at the PDF route", async () => {
    render(await page());
    expect(screen.getByRole("link", { name: "download" })).toHaveAttribute(
      "href",
      "/api/projects/p1/boq-pdf",
    );
  });
});
