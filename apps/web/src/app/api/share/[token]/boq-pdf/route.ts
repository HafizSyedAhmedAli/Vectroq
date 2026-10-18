import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vectroq/db";
import { projectPdfResponse } from "@/lib/project-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const project = await prisma.project.findFirst({
    where: { shareToken: token, shareExpiresAt: { gt: new Date() } },
    include: { lead: true, cadFile: true, organization: true },
  });
  if (!project)
    return NextResponse.json(
      { error: "This link has expired." },
      { status: 404 },
    );
  return projectPdfResponse(project);
}
