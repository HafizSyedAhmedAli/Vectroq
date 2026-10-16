import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vectroq/db";
import { getCurrentOrg } from "@/lib/org";

export async function POST(req: NextRequest) {
  const org = await getCurrentOrg();
  const body = await req.json();
  const { leadId, model, category, city, meetingNotes } = body ?? {};

  if (!leadId || !model || !category || !city) {
    return NextResponse.json(
      { error: "leadId, model, category, and city are required" },
      { status: 400 },
    );
  }

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: org.id },
  });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const project = await prisma.project.create({
    data: {
      organizationId: org.id,
      leadId,
      model,
      category,
      city,
      meetingNotes,
    },
  });
  return NextResponse.json(project, { status: 201 });
}

export async function GET() {
  const org = await getCurrentOrg();
  const projects = await prisma.project.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: "desc" },
    include: { cadFile: true, lead: true },
  });
  return NextResponse.json(projects);
}
