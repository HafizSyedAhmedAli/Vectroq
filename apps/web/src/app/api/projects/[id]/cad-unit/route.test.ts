// apps/web/src/app/api/projects/[id]/cad-unit/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@vectroq/db", () => ({
  prisma: {
    project: { findFirst: vi.fn(), update: vi.fn() },
    cadFile: { findUnique: vi.fn(), update: vi.fn() },
  },
  Prisma: { JsonNull: Symbol("Prisma.JsonNull") },
}));
vi.mock("@/lib/auth/guard", () => ({
  guard: vi.fn().mockResolvedValue({
    ok: true,
    auth: { org: { id: "org_1", slug: "demo", rules: null }, role: "OWNER", user: { id: "u1", email: "t@t.co", name: "T" } },
  }),
}));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/cad-dxf-store", () => ({ readCadDxf: vi.fn() }));

import { Prisma, prisma } from "@vectroq/db";
import { NextResponse } from "next/server";
import { guard } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";
import { readCadDxf } from "@/lib/cad-dxf-store";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (body: unknown) =>
  new Request("http://localhost/api/projects/p1/cad-unit", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

// Unitless 40 x 30 closed room on WALLS: genuinely ambiguous (feet or metres).
const DXF = [
  "0", "SECTION", "2", "ENTITIES",
  "0", "LWPOLYLINE", "8", "WALLS", "90", "4", "70", "1",
  "10", "0", "20", "0", "10", "40", "20", "0", "10", "40", "20", "30", "10", "0", "20", "30",
  "0", "ENDSEC", "0", "EOF", "",
].join("\n");
const longest = (g: any) => Math.max(...g.walls.map((w: any) => w.length));
const suggested = {
  unit: { feetPerUnit: 1, source: "plausibility", confidence: "low", confirmed: false, needsConfirmation: true, unit: "foot" },
  warnings: [],
};

function arrange(over: Record<string, unknown> = {}) {
  (prisma.project.findFirst as any).mockResolvedValue({ id: "p1" });
  (prisma.cadFile.findUnique as any).mockResolvedValue({
    id: "cad_1", projectId: "p1", geometry: { walls: [], rooms: [], openings: [] },
    boq: { total: 5 }, unit: suggested, dxfBlobKey: "cad-dxf/p1-abc.dxf", ...over,
  });
  (readCadDxf as any).mockResolvedValue(DXF);
  (prisma.cadFile.update as any).mockImplementation(({ data }: any) => Promise.resolve({ id: "cad_1", ...data }));
}

describe("POST /api/projects/:id/cad-unit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes through a guard rejection (e.g. viewers)", async () => {
    (guard as any).mockResolvedValueOnce({ ok: false, res: NextResponse.json({ error: "no" }, { status: 403 }) });
    const res = await POST(req({ unit: "foot" }) as any, ctx("p1"));
    expect(res.status).toBe(403);
    expect(prisma.cadFile.update).not.toHaveBeenCalled();
  });

  it("400s on a non-JSON body", async () => {
    expect((await POST(req("nope") as any, ctx("p1"))).status).toBe(400);
  });

  it.each([undefined, "furlong", "3", "99", 3.5, null, {}])("422s on invalid unit %j without touching storage", async (unit) => {
    arrange();
    const res = await POST(req({ unit }) as any, ctx("p1"));
    expect(res.status).toBe(422);
    expect(readCadDxf).not.toHaveBeenCalled();
    expect(prisma.cadFile.update).not.toHaveBeenCalled();
  });

  it("404s for a missing project or CAD file", async () => {
    (prisma.project.findFirst as any).mockResolvedValue(null);
    expect((await POST(req({ unit: "foot" }) as any, ctx("p1"))).status).toBe(404);
    (prisma.project.findFirst as any).mockResolvedValue({ id: "p1" });
    (prisma.cadFile.findUnique as any).mockResolvedValue(null);
    expect((await POST(req({ unit: "foot" }) as any, ctx("p1"))).status).toBe(404);
  });

  it("409s ORIGINAL_DXF_UNAVAILABLE for a legacy row without a stored DXF, and changes nothing", async () => {
    arrange({ dxfBlobKey: null, unit: null });
    const res = await POST(req({ unit: "foot" }) as any, ctx("p1"));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("ORIGINAL_DXF_UNAVAILABLE");
    expect(prisma.cadFile.update).not.toHaveBeenCalled();
  });

  it("409s ORIGINAL_DXF_UNAVAILABLE when the blob has disappeared", async () => {
    arrange();
    (readCadDxf as any).mockResolvedValue(null);
    const res = await POST(req({ unit: "foot" }) as any, ctx("p1"));
    expect(res.status).toBe(409);
    expect(prisma.cadFile.update).not.toHaveBeenCalled();
  });

  it("re-parses the ORIGINAL stored DXF with the chosen unit, replaces geometry, clears the BOQ", async () => {
    arrange();
    const res = await POST(req({ unit: "metre" }) as any, ctx("p1"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(readCadDxf).toHaveBeenCalledWith("cad-dxf/p1-abc.dxf");
    // 40 m = 131.23 ft: the geometry really was re-converted from the raw file
    expect(longest(json.geometry)).toBeCloseTo(40 * 3.280839895, 6);
    const data = (prisma.cadFile.update as any).mock.calls[0][0].data;
    expect(longest(data.geometry)).toBeCloseTo(40 * 3.280839895, 6);
    expect(data.boq).toBe(Prisma.JsonNull);
    expect(data.unit.unit).toMatchObject({ unit: "metre", source: "user", confirmed: true, needsConfirmation: false });
    expect(data.unit.geometryEditedAt).toBeUndefined();
    expect(prisma.project.update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { status: "CAD_UPLOADED" } });
    expect(json.unitState).toMatchObject({ needsConfirmation: false, geometryEdited: false });
    expect(json.dxfBlobKey).toBeUndefined();
    expect(audit).toHaveBeenCalledWith(expect.anything(), "CAD_UNIT_CONFIRMED", "Project", "p1", expect.objectContaining({ unit: "metre", previousUnit: "foot" }));
  });

  it("the user's choice overrides the parser's suggestion and the suggestion is recorded", async () => {
    arrange();
    const res = await POST(req({ unit: "inch" }) as any, ctx("p1"));
    const json = await res.json();
    expect(longest(json.geometry)).toBeCloseTo(40 / 12, 9);
    const data = (prisma.cadFile.update as any).mock.calls[0][0].data;
    expect(data.unit.unit).toMatchObject({ unit: "inch", source: "user", suggestedUnit: "foot" });
  });

  it("accepts the same unit the parser suggested (a plain confirmation)", async () => {
    arrange();
    const res = await POST(req({ unit: "foot" }) as any, ctx("p1"));
    expect(longest((await res.json()).geometry)).toBeCloseTo(40, 9);
  });

  describe("manual corrections are never silently discarded", () => {
    const edited = { ...suggested, geometryEditedAt: "2026-01-01T00:00:00.000Z" };

    it("409s MANUAL_EDITS_WOULD_BE_LOST and changes nothing without an explicit decision", async () => {
      arrange({ unit: edited });
      const res = await POST(req({ unit: "metre" }) as any, ctx("p1"));
      expect(res.status).toBe(409);
      expect((await res.json()).code).toBe("MANUAL_EDITS_WOULD_BE_LOST");
      expect(readCadDxf).not.toHaveBeenCalled();
      expect(prisma.cadFile.update).not.toHaveBeenCalled();
      expect(prisma.project.update).not.toHaveBeenCalled();
    });

    it.each(["true", 1, "yes", false])("a non-boolean-true decision (%j) is not accepted", async (v) => {
      arrange({ unit: edited });
      const res = await POST(req({ unit: "metre", replaceEditedGeometry: v }) as any, ctx("p1"));
      expect(res.status).toBe(409);
    });

    it("proceeds, replaces the edited geometry and records the discard, when explicitly confirmed", async () => {
      arrange({ unit: edited });
      const res = await POST(req({ unit: "metre", replaceEditedGeometry: true }) as any, ctx("p1"));
      expect(res.status).toBe(200);
      const data = (prisma.cadFile.update as any).mock.calls[0][0].data;
      expect(data.unit.geometryEditedAt).toBeUndefined();
      expect(audit).toHaveBeenCalledWith(expect.anything(), "CAD_UNIT_CONFIRMED", "Project", "p1", expect.objectContaining({ discardedManualEdits: true }));
    });
  });

  it("ignores any geometry or unit state in the body: only the re-parse decides", async () => {
    arrange();
    await POST(req({
      unit: "foot",
      geometry: { walls: [], rooms: [], openings: [] },
      unitState: { unit: { feetPerUnit: 99, confirmed: true } },
      meta: { unit: { feetPerUnit: 99, confirmed: true } },
    }) as any, ctx("p1"));
    const data = (prisma.cadFile.update as any).mock.calls[0][0].data;
    expect(longest(data.geometry)).toBeCloseTo(40, 9);
    expect(data.unit.unit.feetPerUnit).toBe(1);
  });
});
