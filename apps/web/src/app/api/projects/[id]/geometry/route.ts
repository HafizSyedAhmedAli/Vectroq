// apps/web/src/app/api/projects/[id]/geometry/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { Geometry } from "@vectroq/shared-types";
import { Prisma, prisma } from "@vectroq/db";
import { getCurrentOrg } from "@/lib/org";
import { guard } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";
import { readUnitState, withGeometryEdited } from "@/lib/cad-unit";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const g = await guard("ESTIMATOR");
  if (!g.ok) return g.res;
  const org = g.auth.org;
  const { id: projectId } = await params;
  const geometry = (await req.json()) as Geometry;

  if (!Array.isArray(geometry?.rooms) || !Array.isArray(geometry?.walls)) {
    return NextResponse.json(
      { error: "Body must be a full Geometry object (walls, rooms, openings)" },
      { status: 400 },
    );
  }

  const cadFile = await prisma.cadFile.findFirst({
    where: { projectId, project: { organizationId: org.id } },
  });

  if (!cadFile) {
    return NextResponse.json(
      { error: "No CAD file uploaded for this project yet" },
      { status: 404 },
    );
  }

  const clearedTotal =
    (cadFile.boq as { total?: number } | null | undefined)?.total ?? null;

  // Only walls/rooms/openings are accepted from the browser. A client-supplied
  // `meta` (or anything else) is dropped, and the unit state and original-DXF
  // key are never taken from the body. An edit never confirms a unit.
  const { walls, rooms, openings } = geometry;
  const clean: Geometry = { walls, rooms, openings: openings ?? [] };

  const data: Record<string, unknown> = {
    geometry: clean as unknown as object,
    boq: Prisma.JsonNull,
  };
  const unitState = readUnitState(cadFile.unit);
  if (unitState) {
    // Same unit decision, plus a note that the geometry now has manual edits so
    // a later unit change cannot silently discard them.
    data.unit = withGeometryEdited(unitState) as unknown as object;
  }

  const updated = await prisma.cadFile.update({
    where: { projectId },
    data,
  });

  await audit(g.auth, "GEOMETRY_EDITED", "Project", projectId, {
    rooms: geometry.rooms.length,
    walls: geometry.walls.length,
    clearedBoqTotal: clearedTotal,
  });

  const { dxfBlobKey: _key, unit: _unit, ...rest } = updated as typeof updated & {
    dxfBlobKey?: string | null;
    unit?: unknown;
  };
  return NextResponse.json(rest);
}
