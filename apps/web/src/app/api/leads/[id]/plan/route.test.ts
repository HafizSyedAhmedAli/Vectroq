// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@vectroq/db", () => ({ prisma: { lead: { findFirst: vi.fn() } } }));
vi.mock("@vercel/blob", () => ({ get: vi.fn() }));
vi.mock("@/lib/auth/guard", () => ({ guard: vi.fn() }));
import { prisma } from "@vectroq/db";
import { get } from "@vercel/blob";
import { guard } from "@/lib/auth/guard";

const call = () =>
  GET(new Request("http://localhost/x") as any, {
    params: Promise.resolve({ id: "l1" }),
  });

describe("GET /api/leads/[id]/plan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (guard as any).mockResolvedValue({
      ok: true,
      auth: { org: { id: "org_1" }, role: "VIEWER", user: { id: "u1" } },
    });
    (prisma.lead.findFirst as any).mockResolvedValue({
      planFileUrl: "plans/x.pdf",
      planFileName: 'my plan"; evil.pdf',
    });
    (get as any).mockResolvedValue({
      statusCode: 200,
      stream: new Response("PDFDATA").body,
      blob: { contentType: "application/pdf" },
    });
  });

  it("streams the file as a private attachment with a sanitised name", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("PDFDATA");
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="my plan_ evil.pdf"',
    );
  });

  it("looks the lead up within the caller's org", async () => {
    await call();
    expect(prisma.lead.findFirst).toHaveBeenCalledWith({
      where: { id: "l1", organizationId: "org_1" },
    });
  });

  it("404s for a lead in another org or without a plan", async () => {
    (prisma.lead.findFirst as any).mockResolvedValue(null);
    expect((await call()).status).toBe(404);
    (prisma.lead.findFirst as any).mockResolvedValue({ planFileUrl: null });
    expect((await call()).status).toBe(404);
    expect(get).not.toHaveBeenCalled();
  });

  it("404s when the blob is missing or not 200", async () => {
    (get as any).mockResolvedValue(null);
    expect((await call()).status).toBe(404);
    (get as any).mockResolvedValue({ statusCode: 304 });
    expect((await call()).status).toBe(404);
  });

  it("returns the guard's response when not signed in", async () => {
    (guard as any).mockResolvedValue({
      ok: false,
      res: Response.json({ error: "Sign in required." }, { status: 401 }),
    });
    expect((await call()).status).toBe(401);
    expect(prisma.lead.findFirst).not.toHaveBeenCalled();
  });
});
