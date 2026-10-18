import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vectroq/db";
import { guard } from "@/lib/auth/guard";
import { isRole } from "@/lib/auth/roles";

type Ctx = { params: Promise<{ id: string }> };

const lastOwnerError = () =>
  NextResponse.json(
    { error: "A company needs at least one owner." },
    { status: 409 },
  );

async function otherOwners(organizationId: string, membershipId: string) {
  return prisma.membership.count({
    where: { organizationId, role: "OWNER", id: { not: membershipId } },
  });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const g = await guard("OWNER");
  if (!g.ok) return g.res;
  const org = g.auth.org;
  const { id } = await params;
  const b = await req.json().catch(() => null);
  if (!isRole(b?.role))
    return NextResponse.json({ error: "Choose a role." }, { status: 400 });

  const m = await prisma.membership.findFirst({
    where: { id, organizationId: org.id },
  });
  if (!m) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (
    m.role === "OWNER" &&
    b.role !== "OWNER" &&
    !(await otherOwners(org.id, id))
  )
    return lastOwnerError();

  await prisma.membership.update({ where: { id }, data: { role: b.role } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const g = await guard("OWNER");
  if (!g.ok) return g.res;
  const org = g.auth.org;
  const { id } = await params;

  const m = await prisma.membership.findFirst({
    where: { id, organizationId: org.id },
  });
  if (!m) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (m.role === "OWNER" && !(await otherOwners(org.id, id)))
    return lastOwnerError();

  await prisma.$transaction([
    prisma.session.deleteMany({
      where: { userId: m.userId, organizationId: org.id },
    }),
    prisma.membership.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true });
}
