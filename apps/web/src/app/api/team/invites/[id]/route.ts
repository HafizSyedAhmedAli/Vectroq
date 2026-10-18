import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vectroq/db";
import { guard } from "@/lib/auth/guard";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await guard("OWNER");
  if (!g.ok) return g.res;
  const { id } = await params;
  await prisma.invitation.deleteMany({
    where: { id, organizationId: g.auth.org.id },
  });
  return NextResponse.json({ ok: true });
}
