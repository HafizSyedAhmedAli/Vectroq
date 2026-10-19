import { NextRequest, NextResponse } from "next/server";
import { Prisma, prisma } from "@vectroq/db";
import {
  DEFAULT_ORG_RULES,
  resolveOrgRules,
  validateOrgRules,
} from "@vectroq/shared-types";
import { guard } from "@/lib/auth/guard";

export async function GET() {
  const g = await guard("VIEWER");
  if (!g.ok) return g.res;
  return NextResponse.json({ rules: resolveOrgRules(g.auth.org.rules) });
}

export async function PATCH(req: NextRequest) {
  const g = await guard("OWNER");
  if (!g.ok) return g.res;
  const org = g.auth.org;
  const body = await req.json().catch(() => null);

  if (body?.reset === true) {
    await prisma.organization.update({
      where: { id: org.id },
      data: { rules: Prisma.JsonNull },
    });
    return NextResponse.json({ rules: DEFAULT_ORG_RULES });
  }

  const v = validateOrgRules(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  await prisma.organization.update({
    where: { id: org.id },
    data: { rules: v.rules as unknown as Prisma.InputJsonValue },
  });
  return NextResponse.json({ rules: v.rules });
}
