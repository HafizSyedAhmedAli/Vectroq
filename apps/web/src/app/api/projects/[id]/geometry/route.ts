// apps/web/src/app/api/projects/[id]/geometry/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { Geometry } from "@vectroq/shared-types";
import { Prisma, prisma } from "@vectroq/db";
import { getCurrentOrg } from "@/lib/org";
import { guard } from "@/lib/auth/guard";

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

  const updated = await prisma.cadFile.update({
    where: { projectId },
    data: { geometry: geometry as unknown as object, boq: Prisma.JsonNull },
  });

  return NextResponse.json(updated);
}
