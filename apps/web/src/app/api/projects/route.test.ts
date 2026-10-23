// apps/web/src/app/api/projects/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST, GET } from "./route";

vi.mock("@vectroq/db", () => ({
  prisma: {
    lead: { findFirst: vi.fn() },
    project: { create: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("@/lib/billing/usage", () => ({
  getUsage: vi.fn().mockResolvedValue({ projectsThisMonth: 0, seatsUsed: 1 }),
}));

vi.mock("@/lib/auth/guard", () => ({
  guard: vi.fn().mockResolvedValue({
    ok: true,
    auth: {
      org: { id: "org_1", slug: "demo" },
      role: "OWNER",
      user: { id: "u1", email: "t@t.co", name: "Test" },
    },
  }),
}));
import { guard } from "@/lib/auth/guard";

import { prisma } from "@vectroq/db";
import { getUsage } from "@/lib/billing/usage";

function req(body: unknown) {
  return new Request("http://localhost/api/projects", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const validBody = {
  leadId: "lead_1",
  model: 2,
  category: "B",
  city: "Hyderabad",
};

describe("POST /api/projects", () => {
  beforeEach(() => vi.clearAllMocks());

  it("400s when leadId, model, category, or city is missing", async () => {
    const res = await POST(req({ ...validBody, city: undefined }) as any);
    expect(res.status).toBe(400);
    expect(prisma.project.create).not.toHaveBeenCalled();
  });

  it("404s when the referenced lead doesn't exist", async () => {
    (prisma.lead.findFirst as any).mockResolvedValue(null);
    const res = await POST(req(validBody) as any);
    expect(res.status).toBe(404);
    expect(prisma.project.create).not.toHaveBeenCalled();
  });

  it("creates a project against an existing lead and returns 201", async () => {
    (prisma.lead.findFirst as any).mockResolvedValue({ id: "lead_1" });
    (prisma.project.create as any).mockResolvedValue({
      id: "proj_1",
      ...validBody,
      status: "NEW",
    });

    const res = await POST(req(validBody) as any);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.id).toBe("proj_1");
    expect(prisma.project.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org_1",
        leadId: "lead_1",
        model: 2,
        category: "B",
        city: "Hyderabad",
        meetingNotes: undefined,
      },
    });
  });
});

describe("GET /api/projects", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists projects newest-first, with lead and CAD file included", async () => {
    (prisma.project.findMany as any).mockResolvedValue([
      { id: "proj_2" },
      { id: "proj_1" },
    ]);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveLength(2);
    expect(prisma.project.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org_1" },
      orderBy: { createdAt: "desc" },
      include: { cadFile: true, lead: true },
    });
  });

  it("403s for a user without permission and writes nothing", async () => {
    (guard as any).mockResolvedValueOnce({
      ok: false,
      res: Response.json({ error: "no" }, { status: 403 }),
    });
    const res = await POST(req(validBody) as any);
    expect(res.status).toBe(403);
    expect(prisma.project.create).not.toHaveBeenCalled();
  });

  it("402s when the Free plan's monthly project limit is reached", async () => {
  (prisma.lead.findFirst as any).mockResolvedValue({ id: "lead_1" });
  (getUsage as any).mockResolvedValueOnce({ projectsThisMonth: 3, seatsUsed: 1 });
  const res = await POST(req(validBody) as any);
  expect(res.status).toBe(402);
  expect(prisma.project.create).not.toHaveBeenCalled();
});
});
