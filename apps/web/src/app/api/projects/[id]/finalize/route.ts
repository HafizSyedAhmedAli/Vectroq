// apps/web/src/app/api/projects/[id]/finalize/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { BOQResult, EngagementModel, Geometry } from "@tmcc/shared-types";
import { estimateFromGeometry } from "@tmcc/rate-cards";
import { prisma } from "@tmcc/db";
import { getRateCardWithBasis, RateUnavailableError } from "@/lib/rate-sets";
import { toRateBasisInfo } from "@/lib/rate-basis";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { id: projectId } = await params;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project)
    return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const cadFile = await prisma.cadFile.findUnique({ where: { projectId } });
  if (!cadFile)
    return NextResponse.json(
      { error: "No CAD file uploaded for this project yet" },
      { status: 404 },
    );

  const category = project.category as "A" | "B" | "C";

  // No placeholder fallback: if no rates exist, nothing is saved and the
  // project is not marked FINALIZED.
  let resolved;
  try {
    resolved = await getRateCardWithBasis(project.city, category);
  } catch (err) {
    if (err instanceof RateUnavailableError) {
      return NextResponse.json(
        {
          error: `${err.message}. Ask office to import the CSR for this region or add rates on the Rates page.`,
        },
        { status: 502 },
      );
    }
    throw err;
  }

  const priced = estimateFromGeometry({
    geometry: cadFile.geometry as unknown as Geometry,
    model: project.model as EngagementModel,
    rateCard: resolved.card,
  });

  if (!priced) {
    return NextResponse.json(
      {
        error: `No rates available for ${project.city} / Category ${project.category}`,
      },
      { status: 422 },
    );
  }

  // Snapshot of which schedule priced this BOQ; later imports don't change it.
  const boq: BOQResult = {
    ...priced,
    rateBasis: toRateBasisInfo(resolved.basis, project.city),
  };

  const updated = await prisma.cadFile.update({
    where: { projectId },
    data: { boq: boq as unknown as object },
  });
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "FINALIZED" },
  });

  return NextResponse.json({ ...updated, boq });
}
