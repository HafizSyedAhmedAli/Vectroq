import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/components/BoqTable", () => ({
  BoqTable: () => <div>boq-table</div>,
}));
vi.mock("@/components/BrandLogo", () => ({ BrandLogo: () => null }));
vi.mock("@/components/SiteFooter", () => ({ SiteFooter: () => null }));
vi.mock("@/components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("@/components/DownloadPdfButton", () => ({
  DownloadPdfButton: ({ href }: { href: string }) => (
    <a href={href}>download</a>
  ),
}));
vi.mock("@/components/ViewerPanel", () => ({
  ViewerPanel: (p: any) => (
    <div
      data-testid="viewer"
      data-floor={p.livingFloor}
      data-cat={p.category}
    />
  ),
}));
vi.mock("@vectroq/db", () => ({ prisma: { project: { findFirst: vi.fn() } } }));

import { prisma } from "@vectroq/db";
import ClientProjectPage, { metadata } from "./page";

const org = {
  id: "org_1",
  name: "Acme",
  tagline: null,
  logoUrl: null,
  primaryColor: "#2563EB",
  phone: "0300 123 4567",
  email: null,
  website: null,
  offices: [],
  rules: null,
};
const project = (o: Record<string, unknown> = {}) => ({
  city: "Karachi",
  model: 2,
  category: "A",
  organization: org,
  lead: { name: "Ali Khan", contact: "0300-9" },
  cadFile: {
    boq: { total: 1_500_000, subtotal: 1, tax: 0, lineItems: [] },
    geometry: { walls: [], openings: [], rooms: [{ area: 100 }, { area: 50 }] },
  },
  ...o,
});
const page = () =>
  ClientProjectPage({ params: Promise.resolve({ token: "tok" }) });

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.project.findFirst as any).mockResolvedValue(project());
});

describe("Client page", () => {
  it("is hidden from search engines", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.referrer).toBe("no-referrer");
  });

  it("only finds a project by an unexpired share token", async () => {
    render(await page());
    const where = (prisma.project.findFirst as any).mock.calls[0][0].where;
    expect(where.shareToken).toBe("tok");
    expect(where.shareExpiresAt.gt).toBeInstanceOf(Date);
  });

  it("404s for an unknown or expired link", async () => {
    (prisma.project.findFirst as any).mockResolvedValue(null);
    await expect(page()).rejects.toThrow("NOT_FOUND");
  });

  it("shows the project details and the total", async () => {
    render(await page());
    expect(screen.getByText("Ali Khan")).toBeInTheDocument();
    expect(screen.getByText("0300-9")).toBeInTheDocument();
    expect(screen.getByText("150 sq ft")).toBeInTheDocument();
    expect(screen.getByText("Rs 1,500,000")).toBeInTheDocument();
    expect(screen.getByText("boq-table")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /0300 123 4567/ })).toHaveAttribute(
      "href",
      "tel:03001234567",
    );
  });

  it("offers the PDF through the share-token route", async () => {
    render(await page());
    expect(screen.getByRole("link", { name: "download" })).toHaveAttribute(
      "href",
      "/api/share/tok/boq-pdf",
    );
  });

  it("gives the 3D viewer the category and marble flooring rule", async () => {
    render(await page());
    expect(screen.getByTestId("viewer")).toHaveAttribute(
      "data-floor",
      "marble",
    );
    expect(screen.getByTestId("viewer")).toHaveAttribute("data-cat", "A");
  });

  it("uses tile flooring for a category without marble", async () => {
    (prisma.project.findFirst as any).mockResolvedValue(
      project({ category: "B" }),
    );
    render(await page());
    expect(screen.getByTestId("viewer")).toHaveAttribute("data-floor", "tile");
  });

  it("shows a placeholder while the estimate is not ready", async () => {
    (prisma.project.findFirst as any).mockResolvedValue(
      project({ cadFile: { boq: null, geometry: null } }),
    );
    render(await page());
    expect(
      screen.getByText(/being finalized by our office/i),
    ).toBeInTheDocument();
    expect(screen.getByAltText("House preview")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "download" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Total Estimated Cost")).not.toBeInTheDocument();
  });

  it("works when the project has no drawing at all", async () => {
    (prisma.project.findFirst as any).mockResolvedValue(
      project({ cadFile: null }),
    );
    render(await page());
    expect(screen.getByAltText("House preview")).toBeInTheDocument();
    expect(screen.queryByText(/sq ft/)).not.toBeInTheDocument();
  });
});
