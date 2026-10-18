import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vectroq/db";
import { guard } from "@/lib/auth/guard";

export async function POST(req: NextRequest) {
  const g = await guard("ESTIMATOR"); // minimum role from the table
  if (!g.ok) return g.res;
  const org = g.auth.org;
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
  const g = await guard("VIEWER"); // minimum role from the table
  if (!g.ok) return g.res;
  const org = g.auth.org;
  const projects = await prisma.project.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: "desc" },
    include: { cadFile: true, lead: true },
  });
  return NextResponse.json(projects);
}
