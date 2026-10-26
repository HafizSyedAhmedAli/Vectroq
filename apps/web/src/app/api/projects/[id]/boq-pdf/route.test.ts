// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@vectroq/db", () => ({ prisma: { project: { findFirst: vi.fn() } } }));
vi.mock("@/lib/auth/guard", () => ({ guard: vi.fn() }));
vi.mock("@/lib/project-pdf", () => ({
  projectPdfResponse: vi.fn(async () => new Response("PDF", { status: 200 })),
}));
import { prisma } from "@vectroq/db";
import { guard } from "@/lib/auth/guard";
import { projectPdfResponse } from "@/lib/project-pdf";

const call = () =>
  GET(new Request("http://localhost/x") as any, {
    params: Promise.resolve({ id: "p1" }),
  });

describe("GET /api/projects/[id]/boq-pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (guard as any).mockResolvedValue({
      ok: true,
      auth: { org: { id: "org_1" }, role: "VIEWER", user: { id: "u1" } },
    });
  });

  it("renders the PDF for a project in the caller's org", async () => {
    const project = { id: "p1" };
    (prisma.project.findFirst as any).mockResolvedValue(project);
    const res = await call();
    expect(await res.text()).toBe("PDF");
    expect(prisma.project.findFirst).toHaveBeenCalledWith({
      where: { id: "p1", organizationId: "org_1" },
      include: { lead: true, cadFile: true, organization: true },
    });
    expect(projectPdfResponse).toHaveBeenCalledWith(project);
  });

  it("404s for a project in another org", async () => {
    (prisma.project.findFirst as any).mockResolvedValue(null);
    expect((await call()).status).toBe(404);
    expect(projectPdfResponse).not.toHaveBeenCalled();
  });

  it("returns 401 when signed out", async () => {
    (guard as any).mockResolvedValue({
      ok: false,
      res: Response.json({ error: "Sign in required." }, { status: 401 }),
    });
    expect((await call()).status).toBe(401);
    expect(prisma.project.findFirst).not.toHaveBeenCalled();
  });
});
