// apps/web/src/app/api/projects/[id]/cad-upload/route.test.ts
//
// @vitest-environment node
//
// jsdom's Request.formData()/File combination hangs indefinitely (a known
// jsdom limitation, not this route) — run this file under Node's native
// fetch implementation instead of the app-wide jsdom environment.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@vectroq/db", () => ({
  prisma: {
    project: { findFirst: vi.fn(), update: vi.fn() },
    cadFile: { upsert: vi.fn(), findUnique: vi.fn() },
  },
  Prisma: { JsonNull: Symbol("Prisma.JsonNull") },
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
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/cad-dxf-store", () => ({
  saveCadDxf: vi.fn(),
  deleteCadDxf: vi.fn(),
}));
import { guard } from "@/lib/auth/guard";
import { deleteCadDxf, saveCadDxf } from "@/lib/cad-dxf-store";

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function uploadReq(file: File, unit?: string) {
  const formData = new FormData();
  formData.append("file", file);
  if (unit !== undefined) formData.append("unit", unit);
  return new Request("http://localhost/api/projects/p1/cad-upload", {
    method: "POST",
    body: formData,
  });
}

// Minimal but valid DXF: one closed room polyline on the WALLS layer with
// a TEXT label inside it, matching what dxf-to-geometry.ts actually reads.
const MINIMAL_DXF = `0
SECTION
2
ENTITIES
0
LWPOLYLINE
8
WALLS
90
4
70
1
10
0
20
0
10
10
20
0
10
10
20
10
10
0
20
10
0
TEXT
8
ROOMS
10
5
20
5
1
Living
0
ENDSEC
0
EOF
`;

describe("POST /api/projects/:id/cad-upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (saveCadDxf as any).mockResolvedValue("cad-dxf/p1-abc.dxf");
    (prisma.cadFile.findUnique as any).mockResolvedValue(null);
  });

  it("404s when the project doesn't exist", async () => {
    (prisma.project.findFirst as any).mockResolvedValue(null);
    const file = new File([MINIMAL_DXF], "plan.dxf", {
      type: "application/dxf",
    });

    const res = await POST(uploadReq(file) as any, ctx("missing"));
    expect(res.status).toBe(404);
  });

  it("rejects .dwg uploads with a clear message", async () => {
    (prisma.project.findFirst as any).mockResolvedValue({ id: "p1" });
    const file = new File(["binary-ish content"], "plan.dwg");

    const res = await POST(uploadReq(file) as any, ctx("p1"));
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.error).toMatch(/dwg/i);
    expect(prisma.cadFile.upsert).not.toHaveBeenCalled();
  });

  it("parses a valid .dxf, stores the geometry, and marks the project CAD_UPLOADED", async () => {
    (prisma.project.findFirst as any).mockResolvedValue({ id: "p1" });
    (prisma.cadFile.upsert as any).mockImplementation(({ create }: any) =>
      Promise.resolve({ id: "cad_1", ...create }),
    );

    const file = new File([MINIMAL_DXF], "plan.dxf");
    const res = await POST(uploadReq(file) as any, ctx("p1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.geometry.rooms).toHaveLength(1);
    expect(json.geometry.rooms[0].name).toBe("Living");
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { status: "CAD_UPLOADED" },
    });
  });

  it("returns 422 (not a 500) when the file can't be parsed as DXF", async () => {
    (prisma.project.findFirst as any).mockResolvedValue({ id: "p1" });
    const file = new File(["not a dxf file at all"], "plan.dxf");

    const res = await POST(uploadReq(file) as any, ctx("p1"));
    expect(res.status).toBe(422);
    expect(prisma.cadFile.upsert).not.toHaveBeenCalled();
  });

  describe("unit handling (Phase 1B)", () => {
    const withHeader = (code: number) =>
      MINIMAL_DXF.replace("SECTION\n2\nENTITIES", `SECTION\n2\nHEADER\n9\n$INSUNITS\n70\n${code}\n0\nENDSEC\n0\nSECTION\n2\nENTITIES`);
    // 30 x 20 ft room: a plausible footprint, unlike the 10 x 10 MINIMAL_DXF.
    const BIG = MINIMAL_DXF.replace("10\n10\n20\n0", "10\n30\n20\n0")
      .replace("10\n10\n20\n10", "10\n30\n20\n20")
      .replace("10\n0\n20\n10", "10\n0\n20\n20");
    const bigWithHeader = (code: number) =>
      BIG.replace("SECTION\n2\nENTITIES", `SECTION\n2\nHEADER\n9\n$INSUNITS\n70\n${code}\n0\nENDSEC\n0\nSECTION\n2\nENTITIES`);
    const arrange = () => {
      (prisma.project.findFirst as any).mockResolvedValue({ id: "p1" });
      (prisma.cadFile.upsert as any).mockImplementation(({ create }: any) =>
        Promise.resolve({ id: "cad_1", fileName: "plan.dxf", boq: null, ...create }),
      );
    };
    const longest = (json: any) => Math.max(...json.geometry.walls.map((w: any) => w.length));

    it("explicit $INSUNITS: stores the unit state and the original DXF key, needs no confirmation", async () => {
      arrange();
      const res = await POST(uploadReq(new File([bigWithHeader(2)], "plan.dxf")) as any, ctx("p1"));
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.unitState).toMatchObject({ needsConfirmation: false, unit: { unit: "foot", source: "header", feetPerUnit: 1 } });
      expect(longest(json)).toBeCloseTo(30, 6);
      const call = (prisma.cadFile.upsert as any).mock.calls[0][0];
      expect(call.create.unit.unit).toMatchObject({ unit: "foot", source: "header" });
      expect(call.create.dxfBlobKey).toBe("cad-dxf/p1-abc.dxf");
      expect(call.update.unit).toEqual(call.create.unit);
      expect(call.update.dxfBlobKey).toBe("cad-dxf/p1-abc.dxf");
      expect(saveCadDxf).toHaveBeenCalledWith("p1", bigWithHeader(2));
      expect(json.dxfBlobKey).toBeUndefined(); // internal
    });

    it("explicit but implausible $INSUNITS (10 x 10 ft): used provisionally, needs confirmation", async () => {
      arrange();
      const res = await POST(uploadReq(new File([withHeader(2)], "plan.dxf")) as any, ctx("p1"));
      const json = await res.json();
      expect(json.unitState.needsConfirmation).toBe(true);
      expect(json.unitState.warnings.map((w: any) => w.code)).toContain("UNIT_HEADER_IMPLAUSIBLE");
    });

    it("missing unit: returns candidates + warnings, stores an UNCONFIRMED state", async () => {
      arrange();
      const res = await POST(uploadReq(new File([MINIMAL_DXF], "plan.dxf")) as any, ctx("p1"));
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.unitState.needsConfirmation).toBe(true);
      expect(json.unitState.unit.confirmed).toBe(false);
      expect(json.unitState.unit.candidates.map((c: any) => c.unit)).toEqual(["inch", "foot", "millimetre", "centimetre", "metre"]);
      expect(json.unitState.warnings.map((w: any) => w.code)).toContain("UNIT_CONFIRMATION_REQUIRED");
      const stored = (prisma.cadFile.upsert as any).mock.calls[0][0].create.unit;
      expect(stored.unit.needsConfirmation).toBe(true);
    });

    it("invalid $INSUNITS in the file: warns and needs confirmation", async () => {
      arrange();
      const res = await POST(uploadReq(new File([withHeader(99)], "plan.dxf")) as any, ctx("p1"));
      const json = await res.json();
      expect(json.unitState.needsConfirmation).toBe(true);
      expect(json.unitState.warnings.map((w: any) => w.code)).toContain("UNIT_METADATA_INVALID");
    });

    it.each([["foot", 10], ["metre", 10 * 3.280839895], ["6", 10 * 3.280839895], ["inch", 10 / 12]])(
      "user-selected unit %s converts with exactly that unit and is stored as confirmed", async (unit, want) => {
        arrange();
        const res = await POST(uploadReq(new File([MINIMAL_DXF], "plan.dxf"), unit) as any, ctx("p1"));
        const json = await res.json();
        expect(res.status).toBe(200);
        expect(longest(json)).toBeCloseTo(want, 6);
        expect(json.unitState).toMatchObject({ needsConfirmation: false, unit: { source: "user", confirmed: true } });
        expect((prisma.cadFile.upsert as any).mock.calls[0][0].create.unit.unit.confirmed).toBe(true);
      });

    it.each(["furlong", "3", "99", "-1", "6.5"])("422s on invalid unit %j and stores nothing", async (unit) => {
      arrange();
      const res = await POST(uploadReq(new File([MINIMAL_DXF], "plan.dxf"), unit) as any, ctx("p1"));
      expect(res.status).toBe(422);
      expect((await res.json()).error).toMatch(/unsupported drawing unit/i);
      expect(saveCadDxf).not.toHaveBeenCalled();
      expect(prisma.cadFile.upsert).not.toHaveBeenCalled();
    });

    it("an empty unit field means 'not chosen' (not an error)", async () => {
      arrange();
      const res = await POST(uploadReq(new File([MINIMAL_DXF], "plan.dxf"), "") as any, ctx("p1"));
      expect(res.status).toBe(200);
      expect((await res.json()).unitState.needsConfirmation).toBe(true);
    });

    it("replaces the previous original DXF blob after a successful re-upload", async () => {
      arrange();
      (prisma.cadFile.findUnique as any).mockResolvedValue({ dxfBlobKey: "cad-dxf/old.dxf" });
      await POST(uploadReq(new File([bigWithHeader(2)], "plan.dxf")) as any, ctx("p1"));
      expect(deleteCadDxf).toHaveBeenCalledWith("cad-dxf/old.dxf");
    });

    it("502s and stores nothing when the original DXF cannot be saved", async () => {
      arrange();
      (saveCadDxf as any).mockRejectedValue(new Error("blob down"));
      const res = await POST(uploadReq(new File([withHeader(2)], "plan.dxf")) as any, ctx("p1"));
      expect(res.status).toBe(502);
      expect(prisma.cadFile.upsert).not.toHaveBeenCalled();
    });

    it("never stores meta on the geometry", async () => {
      arrange();
      await POST(uploadReq(new File([withHeader(2)], "plan.dxf")) as any, ctx("p1"));
      expect((prisma.cadFile.upsert as any).mock.calls[0][0].create.geometry.meta).toBeUndefined();
    });
  });
});
