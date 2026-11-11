// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH } from "./route";

vi.mock("@vectroq/db", () => ({
  prisma: {
    cadFile: { findFirst: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
  Prisma: { JsonNull: Symbol("Prisma.JsonNull") },
}));

import { Prisma, prisma } from "@vectroq/db";

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
import { guard } from "@/lib/auth/guard";

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

const VALID_GEOMETRY = {
  walls: [
    {
      id: "w1",
      startX: 0,
      startY: 0,
      endX: 10,
      endY: 0,
      length: 10,
      height: 10,
      thickness: 0.75,
    },
  ],
  rooms: [{ id: "r1", name: "Living (corrected)", area: 250, type: "general" }],
  openings: [],
};

// The revision the editor loaded; the route refuses a PATCH without it.
const LOADED_REVISION = 5;

function req(body: unknown, expectedRevision: number | undefined = LOADED_REVISION) {
  return new Request("http://localhost/api/projects/p1/geometry", {
    method: "PATCH",
    body: JSON.stringify(
      body && typeof body === "object" && expectedRevision !== undefined
        ? { ...body, expectedRevision }
        : body,
    ),
  });
}

// A successful conditional write: the transaction callback runs on the same
// mock client, updateMany matches one row, and the row is read back.
function arrangeWrite(row: Record<string, unknown>) {
  (prisma.$transaction as any).mockImplementation((fn: any) => fn(prisma));
  (prisma.cadFile.updateMany as any).mockResolvedValue({ count: 1 });
  (prisma.cadFile.findUnique as any).mockResolvedValue({ id: "cad_1", ...row });
}

describe("PATCH /api/projects/:id/geometry", () => {
  beforeEach(() => vi.clearAllMocks());

  it("404s when no CAD file has been uploaded yet", async () => {
    (prisma.cadFile.findFirst as any).mockResolvedValue(null);
    const res = await PATCH(req(VALID_GEOMETRY) as any, ctx("p1"));
    expect(res.status).toBe(404);
  });

  it("400s on a body that is not JSON (no unhandled 500)", async () => {
    const res = await PATCH(
      new Request("http://localhost/api/projects/p1/geometry", { method: "PATCH", body: "{nope" }) as any,
      ctx("p1"),
    );
    expect(res.status).toBe(400);
  });

  it("400s when openings is present but not an array", async () => {
    const res = await PATCH(req({ ...VALID_GEOMETRY, openings: "x" }) as any, ctx("p1"));
    expect(res.status).toBe(400);
    expect(prisma.cadFile.updateMany).not.toHaveBeenCalled();
  });

  it.each([undefined, "5", -1, 1.5, null])("requires an integer expectedRevision (%j)", async (rev) => {
    (prisma.cadFile.findFirst as any).mockResolvedValue({ id: "cad_1", projectId: "p1", revision: LOADED_REVISION });
    const body = { ...VALID_GEOMETRY, ...(rev === undefined ? {} : { expectedRevision: rev }) };
    const res = await PATCH(
      new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify(body) }) as any,
      ctx("p1"),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("CAD_FILE_REVISION_REQUIRED");
    expect(prisma.cadFile.updateMany).not.toHaveBeenCalled();
  });

  it("400s on a malformed body", async () => {
    const res = await PATCH(req({ rooms: "nope" }) as any, ctx("p1"));
    expect(res.status).toBe(400);
    expect(prisma.cadFile.updateMany).not.toHaveBeenCalled();
  });

  it("saves the corrected geometry and clears any stale BOQ", async () => {
    (prisma.cadFile.findFirst as any).mockResolvedValue({
      id: "cad_1",
      projectId: "p1",
      revision: LOADED_REVISION,
    });
    arrangeWrite({ geometry: VALID_GEOMETRY, boq: null, revision: LOADED_REVISION + 1 });

    const res = await PATCH(req(VALID_GEOMETRY) as any, ctx("p1"));
    expect(res.status).toBe(200);
    expect(prisma.cadFile.updateMany).toHaveBeenCalledWith({
      where: { projectId: "p1", revision: LOADED_REVISION },
      data: {
        geometry: VALID_GEOMETRY,
        boq: Prisma.JsonNull,
        revision: { increment: 1 },
      },
    });
    expect((await res.json()).revision).toBe(LOADED_REVISION + 1);
  });

  describe("unit metadata is server-owned", () => {
    const UNIT_STATE = {
      unit: { feetPerUnit: 1, source: "plausibility", confidence: "low", confirmed: false, needsConfirmation: true, unit: "foot" },
      warnings: [{ code: "UNIT_AMBIGUOUS", severity: "warning", message: "m" }],
    };
    const arrange = (unit: unknown) => {
      (prisma.cadFile.findFirst as any).mockResolvedValue({ id: "cad_1", projectId: "p1", unit, dxfBlobKey: "cad-dxf/p1-abc.dxf", boq: { total: 5 }, revision: LOADED_REVISION });
      arrangeWrite({ dxfBlobKey: "cad-dxf/p1-abc.dxf", unit, revision: LOADED_REVISION + 1 });
    };
    const sent = () => (prisma.cadFile.updateMany as any).mock.calls[0][0].data;

    it("keeps the unit decision unchanged, never confirms it, and leaves the DXF key alone", async () => {
      arrange(UNIT_STATE);
      const res = await PATCH(req(VALID_GEOMETRY) as any, ctx("p1"));
      expect(res.status).toBe(200);
      expect(sent().unit.unit).toEqual(UNIT_STATE.unit);
      expect(sent().unit.unit.confirmed).toBe(false);
      expect(sent().unit.unit.needsConfirmation).toBe(true);
      expect(sent().unit.warnings).toEqual(UNIT_STATE.warnings);
      expect("dxfBlobKey" in sent()).toBe(false);
      expect(sent().boq).toBe(Prisma.JsonNull);
    });

    it("records that the geometry was manually edited (so a unit change must ask first)", async () => {
      arrange(UNIT_STATE);
      await PATCH(req(VALID_GEOMETRY) as any, ctx("p1"));
      expect(typeof sent().unit.geometryEditedAt).toBe("string");
      expect(Number.isNaN(Date.parse(sent().unit.geometryEditedAt))).toBe(false);
    });

    it("cannot be used to forge a confirmation: meta / unit fields in the body are dropped", async () => {
      arrange(UNIT_STATE);
      const forged = {
        ...VALID_GEOMETRY,
        meta: { unit: { feetPerUnit: 1, source: "user", confidence: "high", confirmed: true, needsConfirmation: false }, warnings: [], stats: {} },
        unit: { unit: { confirmed: true, needsConfirmation: false } },
        unitState: { unit: { confirmed: true } },
        dxfBlobKey: "attacker/key",
      };
      const res = await PATCH(req(forged) as any, ctx("p1"));
      expect(res.status).toBe(200);
      expect(sent().geometry).toEqual(VALID_GEOMETRY); // no meta, nothing extra stored
      expect(sent().geometry.meta).toBeUndefined();
      expect(sent().unit.unit.confirmed).toBe(false);
      expect(sent().unit.unit.needsConfirmation).toBe(true);
      expect("dxfBlobKey" in sent()).toBe(false);
    });

    it("never turns a confirmed drawing into an unconfirmed one, or the reverse", async () => {
      const confirmed = { unit: { ...UNIT_STATE.unit, source: "user", confirmed: true, needsConfirmation: false }, warnings: [] };
      arrange(confirmed);
      await PATCH(req(VALID_GEOMETRY) as any, ctx("p1"));
      expect(sent().unit.unit).toEqual(confirmed.unit);
    });

    it("a legacy row (no unit state) stays legacy: no state is invented, so it stays unverified", async () => {
      arrange(null);
      await PATCH(req(VALID_GEOMETRY) as any, ctx("p1"));
      expect("unit" in sent()).toBe(false);
    });

    it("does not expose the blob key or unit column in the response", async () => {
      arrange(UNIT_STATE);
      const json = await (await PATCH(req(VALID_GEOMETRY) as any, ctx("p1"))).json();
      expect(json.dxfBlobKey).toBeUndefined();
      expect(json.unit).toBeUndefined();
    });
  });
});
