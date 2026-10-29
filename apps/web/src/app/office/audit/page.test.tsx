import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/org", () => ({
  requirePage: vi.fn().mockResolvedValue({ org: { id: "org_1" } }),
}));
vi.mock("@vectroq/db", () => ({ prisma: { auditLog: { findMany: vi.fn() } } }));

import { prisma } from "@vectroq/db";
import { requirePage } from "@/lib/org";
import AuditPage from "./page";

const log = (over: Record<string, unknown> = {}) => ({
  id: "l1",
  createdAt: new Date("2026-10-26T10:00:00Z"),
  userEmail: "sara@x.co",
  action: "BOQ_CALCULATED",
  entityType: "Project",
  entityId: "p1",
  metadata: null,
  ...over,
});

beforeEach(() => vi.clearAllMocks());

describe("Audit log page", () => {
  it("requires an owner and scopes the query to the org", async () => {
    (prisma.auditLog.findMany as any).mockResolvedValue([]);
    await AuditPage();
    expect(requirePage).toHaveBeenCalledWith("OWNER");
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org_1" },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  });

  it("shows an empty state", async () => {
    (prisma.auditLog.findMany as any).mockResolvedValue([]);
    render(await AuditPage());
    expect(screen.getByText("Nothing recorded yet.")).toBeInTheDocument();
  });

  it("links project actions to the project and formats details", async () => {
    (prisma.auditLog.findMany as any).mockResolvedValue([
      log({
        metadata: {
          total: 1234567,
          city: "Karachi",
          cities: ["A", "B"],
          gone: null,
        },
      }),
    ]);
    render(await AuditPage());
    expect(
      screen.getByRole("link", { name: "BOQ calculated" }),
    ).toHaveAttribute("href", "/office/p1");
    const row = screen.getByText("sara@x.co").closest("tr")!;
    expect(row).toHaveTextContent("total: Rs 1,234,567");
    expect(row).toHaveTextContent("city: Karachi");
    expect(row).toHaveTextContent("cities: A, B");
    expect(row).not.toHaveTextContent("gone");
  });

  it("does not link non-project actions and shows a dash for unknown users", async () => {
    (prisma.auditLog.findMany as any).mockResolvedValue([
      log({
        id: "l2",
        action: "LOGIN",
        entityType: "User",
        entityId: "u1",
        userEmail: null,
      }),
      log({
        id: "l3",
        action: "SOMETHING_NEW",
        entityType: "Thing",
        entityId: null,
      }),
    ]);
    render(await AuditPage());
    expect(screen.getByText("Signed in")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Signed in" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("-")).toBeInTheDocument();
    expect(screen.getByText("SOMETHING_NEW")).toBeInTheDocument();
  });
});
