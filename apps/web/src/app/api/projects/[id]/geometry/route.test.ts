// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH } from "./route";

vi.mock("@tmcc/db", () => ({
  prisma: { cadFile: { findUnique: vi.fn(), update: vi.fn() } },
  Prisma: { JsonNull: Symbol("Prisma.JsonNull") },
}));

import { Prisma, prisma } from "@tmcc/db";

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

function req(body: unknown) {
  return new Request("http://localhost/api/projects/p1/geometry", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/projects/:id/geometry", () => {
  beforeEach(() => vi.clearAllMocks());

  it("404s when no CAD file has been uploaded yet", async () => {
    (prisma.cadFile.findUnique as any).mockResolvedValue(null);
    const res = await PATCH(req(VALID_GEOMETRY) as any, ctx("p1"));
    expect(res.status).toBe(404);
  });

  it("400s on a malformed body", async () => {
    const res = await PATCH(req({ rooms: "nope" }) as any, ctx("p1"));
    expect(res.status).toBe(400);
    expect(prisma.cadFile.update).not.toHaveBeenCalled();
  });

  it("saves the corrected geometry and clears any stale BOQ", async () => {
    (prisma.cadFile.findUnique as any).mockResolvedValue({
      id: "cad_1",
      projectId: "p1",
    });
    (prisma.cadFile.update as any).mockResolvedValue({
      id: "cad_1",
      geometry: VALID_GEOMETRY,
      boq: null,
    });

    const res = await PATCH(req(VALID_GEOMETRY) as any, ctx("p1"));
    expect(res.status).toBe(200);
    expect(prisma.cadFile.update).toHaveBeenCalledWith({
      where: { projectId: "p1" },
      data: { geometry: VALID_GEOMETRY, boq: Prisma.JsonNull },
    });
  });
});
