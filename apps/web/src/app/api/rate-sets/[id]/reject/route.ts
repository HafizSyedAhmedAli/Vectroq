import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@tmcc/db";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const result = await prisma.rateSet.updateMany({
    where: { id, status: "DRAFT" },
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
