// apps/web/src/app/api/projects/[id]/finalize/route.ts
import { guard } from "@/lib/auth/guard";
import { toRateBasisInfo } from "@/lib/rate-basis";
import { getRateCardWithBasis, RateUnavailableError } from "@/lib/rate-sets";
import { prisma } from "@vectroq/db";
import { estimateFromGeometry } from "@vectroq/rate-cards";
import type {
  BOQResult,
  EngagementModel,
  Geometry,
} from "@vectroq/shared-types";
import { NextRequest, NextResponse } from "next/server";
import { resolveOrgRules } from "@vectroq/shared-types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const g = await guard("ESTIMATOR");
  if (!g.ok) return g.res;
  const org = g.auth.org;
  const rules = resolveOrgRules(org.rules);
  const { id: projectId } = await params;

  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: org.id },
  });

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
    resolved = await getRateCardWithBasis(
      org.id,
      project.city,
      category,
      rules,
    );
  } catch (err) {
    if (err instanceof RateUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    throw err;
  }

  const priced = estimateFromGeometry({
    geometry: cadFile.geometry as unknown as Geometry,
    model: project.model as EngagementModel,
    rateCard: resolved.card,
    rules,
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
