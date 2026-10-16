// apps/web/src/app/api/projects/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vectroq/db";
import { getCurrentOrg } from "@/lib/org";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Backs the dashboard (and the client-facing summary page): a single
// fetch that returns everything one Project has accumulated so far — lead
// details, the uploaded CAD file's reviewed geometry/BOQ, and the render if
// one exists. No auth/roles yet, same caveat as every
// other route here.
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id: projectId } = await params;

  const org = await getCurrentOrg();

  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: org.id },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(project);
}
