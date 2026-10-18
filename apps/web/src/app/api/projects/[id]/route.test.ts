// apps/web/src/app/api/projects/[id]/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@vectroq/db", () => ({
  prisma: { project: { findFirst: vi.fn() } },
}));

import { prisma } from "@vectroq/db";

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

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function req() {
  return new Request("http://localhost/api/projects/p1");
}

describe("GET /api/projects/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("404s when the project doesn't exist", async () => {
    (prisma.project.findFirst as any).mockResolvedValue(null);

    const res = await GET(req() as any, ctx("missing"));
    expect(res.status).toBe(404);
  });

  it("returns the project with lead, cadFile, and render included", async () => {
    (prisma.project.findFirst as any).mockResolvedValue({
      id: "p1",
      lead: { id: "lead_1", name: "Test Client" },
      cadFile: { id: "cad_1", geometry: {}, boq: null },
      render: null,
    });

    const res = await GET(req() as any, ctx("p1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.id).toBe("p1");
    expect(json.lead.name).toBe("Test Client");
    expect(prisma.project.findFirst).toHaveBeenCalledWith({
      where: { id: "p1", organizationId: "org_1" },
      include: { lead: true, cadFile: true, render: true },
    });
  });
});
