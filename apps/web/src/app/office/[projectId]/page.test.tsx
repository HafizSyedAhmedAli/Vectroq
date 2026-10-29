import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/org", () => ({ requirePage: vi.fn() }));
vi.mock("@/components/CompanyIllustration", () => ({
  CompanyIllustration: () => null,
}));
vi.mock("@/components/ProjectWorkspace", () => ({
  ProjectWorkspace: (p: unknown) => (
    <pre data-testid="workspace">{JSON.stringify(p)}</pre>
  ),
}));
vi.mock("@/components/ShareLinkPanel", () => ({
  ShareLinkPanel: (p: unknown) => (
    <pre data-testid="share">{JSON.stringify(p)}</pre>
  ),
}));
vi.mock("@vectroq/db", () => ({
  prisma: { project: { findFirst: vi.fn() }, rateSet: { findFirst: vi.fn() } },
}));

import { prisma } from "@vectroq/db";
import { requirePage } from "@/lib/org";
import OfficeProjectPage from "./page";

const geometry = { walls: [], rooms: [], openings: [] };
const project = (o: Record<string, unknown> = {}) => ({
  id: "p1",
  city: "Karachi",
  category: "A",
  model: 2,
  status: "FINALIZED",
  createdAt: new Date("2026-10-01T00:00:00Z"),
  meetingNotes: null,
  shareToken: null,
  shareExpiresAt: null,
  lead: { name: "Ali Khan" },
  cadFile: {
    geometry,
    boq: { total: 1 },
    fileName: "plan.dxf",
    updatedAt: new Date("2026-10-02T00:00:00Z"),
  },
  ...o,
});
const as = (role = "OWNER") =>
  (requirePage as any).mockResolvedValue({
    org: { id: "org_1", rules: null },
    role,
  });
const page = () =>
  OfficeProjectPage({ params: Promise.resolve({ projectId: "p1" }) });
const ws = () => JSON.parse(screen.getByTestId("workspace").textContent!);

beforeEach(() => {
  vi.clearAllMocks();
  as();
  (prisma.project.findFirst as any).mockResolvedValue(project());
  (prisma.rateSet.findFirst as any).mockResolvedValue({
    approvedAt: new Date("2026-10-01T00:00:00Z"),
    approvedBy: "Sara",
  });
});

describe("Project page", () => {
  it("404s for a project outside the company", async () => {
    (prisma.project.findFirst as any).mockResolvedValue(null);
    await expect(page()).rejects.toThrow("NOT_FOUND");
    expect((prisma.project.findFirst as any).mock.calls[0][0].where).toEqual({
      id: "p1",
      organizationId: "org_1",
    });
  });

  it("shows the client, location, type and category", async () => {
    render(await page());
    expect(
      screen.getByRole("heading", { level: 1, name: "Ali Khan" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Karachi")).toBeInTheDocument();
    expect(
      screen.getByText("Construction on Client's Plot"),
    ).toBeInTheDocument();
    expect(screen.getByText("A · Premium")).toBeInTheDocument();
    expect(screen.getByText("Finalized")).toBeInTheDocument();
  });

  it("states which rates are applied", async () => {
    render(await page());
    expect(
      screen.getByText(/Rates approved 2026-10-01 by Sara/),
    ).toBeInTheDocument();
  });

  it("says when there are no rates for the city", async () => {
    (prisma.rateSet.findFirst as any).mockResolvedValue(null);
    render(await page());
    expect(
      screen.getByText(/No rates loaded for this city yet/),
    ).toBeInTheDocument();
  });

  it("looks up rates for the company or the shared library, preferring the company's", async () => {
    render(await page());
    const arg = (prisma.rateSet.findFirst as any).mock.calls[0][0];
    expect(arg.where).toMatchObject({
      OR: [{ organizationId: "org_1" }, { organizationId: null }],
      city: "Karachi",
      category: "A",
      status: "APPROVED",
    });
    expect(arg.orderBy[0]).toEqual({
      organizationId: { sort: "asc", nulls: "last" },
    });
  });

  it("gives the workspace the saved drawing, BOQ and marble flooring for Category A", async () => {
    render(await page());
    expect(ws()).toMatchObject({
      projectId: "p1",
      initialGeometry: geometry,
      initialBoq: { total: 1 },
      initialFileName: "plan.dxf",
      livingFloor: "marble",
      category: "A",
    });
  });

  it("uses tile flooring for Category B and nulls when nothing is uploaded", async () => {
    (prisma.project.findFirst as any).mockResolvedValue(
      project({ category: "B", cadFile: null }),
    );
    render(await page());
    expect(ws()).toMatchObject({
      livingFloor: "tile",
      initialGeometry: null,
      initialBoq: null,
      initialFileName: null,
      updatedLabel: null,
    });
  });

  it("shows the share panel to estimators once a BOQ exists", async () => {
    as("ESTIMATOR");
    render(await page());
    expect(JSON.parse(screen.getByTestId("share").textContent!)).toMatchObject({
      projectId: "p1",
      initial: null,
    });
  });

  it("passes an existing share link to the panel", async () => {
    const exp = new Date("2026-12-01T00:00:00Z");
    (prisma.project.findFirst as any).mockResolvedValue(
      project({ shareToken: "tok", shareExpiresAt: exp }),
    );
    render(await page());
    expect(
      JSON.parse(screen.getByTestId("share").textContent!).initial,
    ).toMatchObject({
      token: "tok",
      expiresAt: exp.toISOString(),
    });
  });

  it("hides the share panel from viewers and when there is no BOQ", async () => {
    as("VIEWER");
    const { unmount } = render(await page());
    expect(screen.queryByTestId("share")).not.toBeInTheDocument();
    unmount();
    as("OWNER");
    (prisma.project.findFirst as any).mockResolvedValue(
      project({
        cadFile: {
          geometry,
          boq: null,
          fileName: "p.dxf",
          updatedAt: new Date(),
        },
      }),
    );
    render(await page());
    expect(screen.queryByTestId("share")).not.toBeInTheDocument();
  });

  it("shows meeting notes when present", async () => {
    (prisma.project.findFirst as any).mockResolvedValue(
      project({ meetingNotes: "Wants a pool" }),
    );
    render(await page());
    expect(screen.getByText(/Wants a pool/)).toBeInTheDocument();
  });
});
