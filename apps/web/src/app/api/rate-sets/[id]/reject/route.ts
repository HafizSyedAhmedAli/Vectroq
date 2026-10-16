import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vectroq/db";
import { getCurrentOrg } from "@/lib/org";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const org = await getCurrentOrg();
  const result = await prisma.rateSet.updateMany({
    where: { id, organizationId: org.id, status: "DRAFT" },
    data: { status: "REJECTED" },
  });

  if (result.count === 0) {
    return NextResponse.json(
      { error: "No DRAFT rate set with that id" },
      { status: 404 },
    );
  }
  return NextResponse.json({ id, status: "REJECTED" });
}
