// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@vectroq/db", () => ({ prisma: { project: { findFirst: vi.fn() } } }));
vi.mock("@/lib/project-pdf", () => ({
  projectPdfResponse: vi.fn(async () => new Response("PDF", { status: 200 })),
}));
import { prisma } from "@vectroq/db";
import { projectPdfResponse } from "@/lib/project-pdf";

const call = (token = "tok") =>
  GET(new Request("http://localhost/x") as any, {
    params: Promise.resolve({ token }),
  });

describe("GET /api/share/[token]/boq-pdf", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the PDF for a valid, unexpired share token (no login)", async () => {
    const project = { id: "p1" };
    (prisma.project.findFirst as any).mockResolvedValue(project);
    const res = await call("tok");
    expect(await res.text()).toBe("PDF");
    const where = (prisma.project.findFirst as any).mock.calls[0][0].where;
    expect(where.shareToken).toBe("tok");
    expect(where.shareExpiresAt.gt).toBeInstanceOf(Date);
    expect(projectPdfResponse).toHaveBeenCalledWith(project);
  });

  it("404s with an expiry message for unknown or expired tokens", async () => {
    (prisma.project.findFirst as any).mockResolvedValue(null);
    const res = await call("bad");
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/expired/);
    expect(projectPdfResponse).not.toHaveBeenCalled();
  });
});
