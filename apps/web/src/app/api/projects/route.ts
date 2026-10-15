// apps/web/src/app/api/projects/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@tmcc/db";

// FR-5/6: office turns a Lead into a Project once the design-brief meeting
// (SRS §3 step 4) has happened. No auth/roles yet (FR-20 not started) — this
// route is reachable by anyone who can hit the API, same as /api/leads
// today. Don't treat this as access-controlled.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { leadId, model, category, city, meetingNotes } = body ?? {};

  if (!leadId || !model || !category || !city) {
    return NextResponse.json(
      { error: "leadId, model, category, and city are required" },
      { status: 400 },
    );
  }

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const project = await prisma.project.create({
    data: { leadId, model, category, city, meetingNotes },
  });

  return NextResponse.json(project, { status: 201 });
}

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: { cadFile: true, lead: true },
  });
  return NextResponse.json(projects);
}