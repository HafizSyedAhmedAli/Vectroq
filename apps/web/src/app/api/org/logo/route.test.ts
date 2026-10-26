// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@vectroq/db", () => ({
  prisma: { organization: { update: vi.fn() } },
}));
vi.mock("@/lib/auth/guard", () => ({ guard: vi.fn() }));
vi.mock("@/lib/org", () => ({ getCurrentOrg: vi.fn() }));
vi.mock("@vercel/blob", () => ({ put: vi.fn() }));
vi.mock("@/lib/upload-guard", () => ({ checkFileContent: vi.fn() }));
import { prisma } from "@vectroq/db";
import { guard } from "@/lib/auth/guard";
import { put } from "@vercel/blob";
import { checkFileContent } from "@/lib/upload-guard";

const asRole = (role: string) =>
  (guard as any).mockImplementation(async (min: string) => {
    const rank: any = { VIEWER: 0, ESTIMATOR: 1, OWNER: 2 };
    return rank[role] >= rank[min]
      ? { ok: true, auth: { org: { id: "org_1" }, role, user: { id: "u1" } } }
      : { ok: false, res: Response.json({ error: "no" }, { status: 403 }) };
  });
const req = (file?: File) => {
  const fd = new FormData();
  if (file) fd.set("file", file);
  return new Request("http://localhost/api/org/logo", {
    method: "POST",
    body: fd,
  }) as any;
};
const png = (size = 10) =>
  new File([new Uint8Array(size)], "logo.png", { type: "image/png" });

describe("POST /api/org/logo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asRole("OWNER");
    (checkFileContent as any).mockResolvedValue(null);
    (put as any).mockResolvedValue({ url: "https://blob/logo.png" });
  });

  it("uploads a PNG and stores the URL on the org", async () => {
    const res = await POST(req(png()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ logoUrl: "https://blob/logo.png" });
    expect((put as any).mock.calls[0][0]).toBe("org-logos/org_1.png");
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: "org_1" },
      data: { logoUrl: "https://blob/logo.png" },
    });
  });

  it("uses a jpg extension for JPEG files", async () => {
    await POST(req(new File([new Uint8Array(5)], "a.jpg", { type: "image/jpeg" })));
    expect((put as any).mock.calls[0][0]).toBe("org-logos/org_1.jpg");
  });

  it("requires a file", async () => {
    expect((await POST(req())).status).toBe(400);
  });

  it("rejects non PNG/JPG types", async () => {
    const svg = new File(["<svg/>"], "l.svg", { type: "image/svg+xml" });
    const res = await POST(req(svg));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/PNG or JPG/);
    expect(put).not.toHaveBeenCalled();
  });

  it("rejects empty and oversize files", async () => {
    expect((await POST(req(png(0)))).status).toBe(400);
    expect((await POST(req(png(1024 * 1024 + 1)))).status).toBe(400);
    expect(put).not.toHaveBeenCalled();
  });

  it("rejects when the content does not match the extension", async () => {
    (checkFileContent as any).mockResolvedValue("Not really a PNG.");
    const res = await POST(req(png()));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Not really a PNG.");
    expect(put).not.toHaveBeenCalled();
  });

  it.each(["ESTIMATOR", "VIEWER"])("forbids %s", async (role) => {
    asRole(role);
    expect((await POST(req(png()))).status).toBe(403);
    expect(put).not.toHaveBeenCalled();
  });
});
