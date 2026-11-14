// apps/web/src/app/api/projects/[id]/geometry/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { Geometry } from "@vectroq/shared-types";
import { Prisma, prisma } from "@vectroq/db";
import { getCurrentOrg } from "@/lib/org";
import { guard } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";
import { readUnitState, withGeometryEdited } from "@/lib/cad-unit";
import {
  parseRevision,
  revisionConflictResponse,
  revisionRequiredResponse,
  updateCadFileAtRevision,
  withRevisionConflict,
} from "@/lib/cad-revision";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const g = await guard("ESTIMATOR");
  if (!g.ok) return g.res;
  const org = g.auth.org;
  const { id: projectId } = await params;
  let geometry: Geometry & { expectedRevision?: unknown };
  try {
    geometry = (await req.json()) as Geometry & { expectedRevision?: unknown };
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  if (!Array.isArray(geometry?.rooms) || !Array.isArray(geometry?.walls)) {
    return NextResponse.json(
      { error: "Body must be a full Geometry object (walls, rooms, openings)" },
      { status: 400 },
    );
  }
  if (geometry.openings !== undefined && !Array.isArray(geometry.openings)) {
    return NextResponse.json(
      { error: "openings must be an array when provided." },
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

  // The revision the editor loaded. Without it a stale tab could overwrite
  // newer geometry or attach old-scale geometry to a newly confirmed unit.
  const expectedRevision = parseRevision(geometry.expectedRevision);
  if (expectedRevision === null) return revisionRequiredResponse();

  if (cadFile.revision !== expectedRevision) return revisionConflictResponse();

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

  // One transaction: the conditional CadFile write (the BOQ is cleared) and, if
  // the project was FINALIZED, its demotion back to CAD_UPLOADED. A project must
  // never read FINALIZED while its BOQ is gone. The status update is itself
  // conditional on FINALIZED, so any other status is left exactly as it was.
  const result = await withRevisionConflict(() =>
    prisma.$transaction(async (tx) => {
      const row = await updateCadFileAtRevision(
        tx,
        projectId,
        expectedRevision,
        data as Parameters<typeof updateCadFileAtRevision>[3],
      );
      await tx.project.updateMany({
        where: { id: projectId, status: "FINALIZED" },
        data: { status: "CAD_UPLOADED" },
      });
      return row;
    }),
  );
  if (result instanceof NextResponse) return result;
  const updated = result;

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
