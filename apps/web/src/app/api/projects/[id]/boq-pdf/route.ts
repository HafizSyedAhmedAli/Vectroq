import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vectroq/db";
import { guard } from "@/lib/auth/guard";
import { projectPdfResponse } from "@/lib/project-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await guard("VIEWER");
  if (!g.ok) return g.res;
  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id, organizationId: g.auth.org.id },
    include: { lead: true, cadFile: true, organization: true },
  });
  if (!project)
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return projectPdfResponse(project);
}
