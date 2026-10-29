import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/org", () => ({ requirePage: vi.fn() }));
vi.mock("@vectroq/db", () => ({
  prisma: {
    organization: { findMany: vi.fn() },
    project: { groupBy: vi.fn() },
  },
}));

import { prisma } from "@vectroq/db";
import { requirePage } from "@/lib/org";
import AdminPage from "./page";

const SAVED = process.env.PLATFORM_ADMIN_EMAILS;
const as = (email: string) =>
  (requirePage as any).mockResolvedValue({ user: { email } });
const org = (id: string, plan: string, projects: number) => ({
  id,
  name: `Org ${id}`,
  slug: id,
  plan,
  planStatus: null,
  createdAt: new Date("2026-09-01T00:00:00Z"),
  _count: { projects, memberships: 2, leads: 5 },
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.PLATFORM_ADMIN_EMAILS = "boss@x.co, Admin@X.co";
  (prisma.organization.findMany as any).mockResolvedValue([
    org("o1", "FREE", 5),
    org("o2", "PRO", 20),
  ]);
  (prisma.project.groupBy as any).mockResolvedValue([
    { organizationId: "o1", _count: { _all: 3 } },
    { organizationId: "o2", _count: { _all: 9 } },
  ]);
});
afterEach(() => {
  if (SAVED === undefined) delete process.env.PLATFORM_ADMIN_EMAILS;
  else process.env.PLATFORM_ADMIN_EMAILS = SAVED;
});

describe("Platform admin page", () => {
  it("404s for a signed-in user who is not a platform admin", async () => {
    as("someone@x.co");
    await expect(AdminPage()).rejects.toThrow("NOT_FOUND");
    expect(prisma.organization.findMany).not.toHaveBeenCalled();
  });

  it("404s when no admins are configured", async () => {
    process.env.PLATFORM_ADMIN_EMAILS = "";
    as("boss@x.co");
    await expect(AdminPage()).rejects.toThrow("NOT_FOUND");
  });

  it("matches admin emails case-insensitively", async () => {
    as("ADMIN@x.co");
    render(await AdminPage());
    expect(screen.getByText("Platform admin")).toBeInTheDocument();
  });

  it("excludes demo companies", async () => {
    as("boss@x.co");
    await AdminPage();
    expect(
      (prisma.organization.findMany as any).mock.calls[0][0].where,
    ).toEqual({ isDemo: false });
  });

  it("counts companies per plan", async () => {
    as("boss@x.co");
    render(await AdminPage());
    expect(screen.getByText("Companies").nextElementSibling).toHaveTextContent(
      "2",
    );
    expect(screen.getByText("Free").nextElementSibling).toHaveTextContent("1");
    expect(screen.getByText("Business").nextElementSibling).toHaveTextContent(
      "0",
    );
  });

  it("shows month / total projects and flags a Free org at its limit", async () => {
    as("boss@x.co");
    render(await AdminPage());
    const free = screen.getByText("3 / 5");
    expect(free.className).toContain("text-red-600");
    const pro = screen.getByText("9 / 20");
    expect(pro.className).not.toContain("text-red-600");
  });

  it("shows 0 for a company with no projects this month", async () => {
    as("boss@x.co");
    (prisma.project.groupBy as any).mockResolvedValue([]);
    render(await AdminPage());
    expect(screen.getByText("0 / 5")).toBeInTheDocument();
  });
});
