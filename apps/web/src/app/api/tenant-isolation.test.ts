// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  currentOrg: { id: "org_1", slug: "a", rules: null } as {
    id: string;
    slug: string;
    rules: null;
  },
  projects: [
    {
      id: "p_org1",
      organizationId: "org_1",
      city: "Karachi",
      category: "B",
      model: 2,
    },
    {
      id: "p_org2",
      organizationId: "org_2",
      city: "Lahore",
      category: "B",
      model: 2,
    },
  ],
  cads: [
    {
      id: "c1",
      projectId: "p_org1",
      geometry: { walls: [], rooms: [], openings: [] },
      boq: null,
    },
    {
      id: "c2",
      projectId: "p_org2",
      geometry: { walls: [], rooms: [], openings: [] },
      boq: null,
    },
  ],
}));

const orgOf = (projectId: string) =>
  db.projects.find((p) => p.id === projectId)?.organizationId;

vi.mock("@vectroq/db", () => ({
  Prisma: { JsonNull: Symbol("JsonNull") },
  prisma: {
    project: {
      // Only matches when BOTH the id and the organization match, like real SQL.
      findFirst: vi.fn(
        async ({ where }: any) =>
          db.projects.find(
            (p) =>
              (where.id === undefined || p.id === where.id) &&
              (where.organizationId === undefined ||
                p.organizationId === where.organizationId),
          ) ?? null,
      ),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    cadFile: {
      findFirst: vi.fn(
        async ({ where }: any) =>
          db.cads.find(
            (c) =>
              c.projectId === where.projectId &&
              orgOf(c.projectId) === where.project?.organizationId,
          ) ?? null,
      ),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/guard", () => ({
  guard: vi.fn(async () => ({
    ok: true,
    auth: {
      org: db.currentOrg,
      role: "OWNER",
      user: { id: "u1", email: "t@t.co", name: "T", emailVerified: true },
    },
  })),
}));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));

import { prisma } from "@vectroq/db";
import { GET as getProject } from "./projects/[id]/route";
import { PATCH as patchGeometry } from "./projects/[id]/geometry/route";
import { POST as finalize } from "./projects/[id]/finalize/route";
import { POST as createShare } from "./projects/[id]/share/route";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (body?: unknown) =>
  new Request("http://localhost/x", {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as any;

const GEOMETRY = { walls: [], rooms: [], openings: [] };

describe("tenant isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.currentOrg = { id: "org_1", slug: "a", rules: null };
  });

  it("control: a company can open its own project", async () => {
    const res = await getProject(req(), ctx("p_org1"));
    expect(res.status).toBe(200);
  });

  describe("signed in as org_2, targeting org_1's project", () => {
    beforeEach(() => {
      db.currentOrg = { id: "org_2", slug: "b", rules: null };
    });

    it("GET /api/projects/:id -> 404", async () => {
      expect((await getProject(req(), ctx("p_org1"))).status).toBe(404);
    });

    it("PATCH geometry -> 404 and writes nothing", async () => {
      const res = await patchGeometry(req(GEOMETRY), ctx("p_org1"));
      expect(res.status).toBe(404);
      expect(prisma.cadFile.update).not.toHaveBeenCalled();
    });

    it("POST finalize -> 404 and prices nothing", async () => {
      const res = await finalize(req(), ctx("p_org1"));
      expect(res.status).toBe(404);
      expect(prisma.cadFile.update).not.toHaveBeenCalled();
      expect(prisma.project.update).not.toHaveBeenCalled();
    });

    it("POST share -> 404 and creates no link", async () => {
      const res = await createShare(req({ days: 30 }), ctx("p_org1"));
      expect(res.status).toBe(404);
      expect(prisma.project.update).not.toHaveBeenCalled();
    });
  });
});
