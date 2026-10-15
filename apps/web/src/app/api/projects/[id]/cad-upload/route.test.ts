// apps/web/src/app/api/projects/[id]/cad-upload/route.test.ts
//
// @vitest-environment node
//
// jsdom's Request.formData()/File combination hangs indefinitely (a known
// jsdom limitation, not this route) — run this file under Node's native
// fetch implementation instead of the app-wide jsdom environment.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@tmcc/db", () => ({
  prisma: {
    project: { findUnique: vi.fn(), update: vi.fn() },
    cadFile: { upsert: vi.fn() },
  },
  Prisma: { JsonNull: Symbol("Prisma.JsonNull") },
}));

import { prisma } from "@tmcc/db";

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function uploadReq(file: File) {
  const formData = new FormData();
  formData.append("file", file);
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
  beforeEach(() => vi.clearAllMocks());

  it("404s when the project doesn't exist", async () => {
    (prisma.project.findUnique as any).mockResolvedValue(null);
    const file = new File([MINIMAL_DXF], "plan.dxf", {
      type: "application/dxf",
    });

    const res = await POST(uploadReq(file) as any, ctx("missing"));
    expect(res.status).toBe(404);
  });

  it("rejects .dwg uploads with a clear message (FR-8 conversion not built yet)", async () => {
    (prisma.project.findUnique as any).mockResolvedValue({ id: "p1" });
    const file = new File(["binary-ish content"], "plan.dwg");

    const res = await POST(uploadReq(file) as any, ctx("p1"));
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.error).toMatch(/dwg/i);
    expect(prisma.cadFile.upsert).not.toHaveBeenCalled();
  });

  it("parses a valid .dxf, stores the geometry, and marks the project CAD_UPLOADED", async () => {
    (prisma.project.findUnique as any).mockResolvedValue({ id: "p1" });
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
    (prisma.project.findUnique as any).mockResolvedValue({ id: "p1" });
    const file = new File(["not a dxf file at all"], "plan.dxf");

    const res = await POST(uploadReq(file) as any, ctx("p1"));
    expect(res.status).toBe(422);
    expect(prisma.cadFile.upsert).not.toHaveBeenCalled();
  });
});
