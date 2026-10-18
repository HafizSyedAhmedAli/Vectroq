import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vectroq/db";
import { guard } from "@/lib/auth/guard";
import { newToken } from "@/lib/auth/tokens";

type Ctx = { params: Promise<{ id: string }> };
const DURATIONS = [7, 30, 90];

export async function POST(req: NextRequest, { params }: Ctx) {
  const g = await guard("ESTIMATOR");
  if (!g.ok) return g.res;
  const { id } = await params;
  const b = await req.json().catch(() => null);
  const days = DURATIONS.includes(Number(b?.days)) ? Number(b.days) : 30;

  const project = await prisma.project.findFirst({
    where: { id, organizationId: g.auth.org.id },
  });
  if (!project)
    return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const shareToken = newToken(24);
  const shareExpiresAt = new Date(Date.now() + days * 86_400_000);
  await prisma.project.update({
    where: { id },
    data: { shareToken, shareExpiresAt },
  });
  return NextResponse.json({
    token: shareToken,
    expiresAt: shareExpiresAt.toISOString(),
  });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const g = await guard("ESTIMATOR");
  if (!g.ok) return g.res;
  const { id } = await params;
  await prisma.project.updateMany({
    where: { id, organizationId: g.auth.org.id },
    data: { shareToken: null, shareExpiresAt: null },
  });
  return NextResponse.json({ ok: true });
}
