import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vectroq/db";
import { getCurrentOrg } from "@/lib/org";
import { validateOrgSettings } from "@/lib/org-settings";
import { guard } from "@/lib/auth/guard";

export async function PATCH(req: NextRequest) {
  const g = await guard("OWNER"); // minimum role from the table
  if (!g.ok) return g.res;
  const org = g.auth.org;
  const body = await req.json().catch(() => null);

  if (body?.removeLogo === true) {
    await prisma.organization.update({
      where: { id: org.id },
      data: { logoUrl: null },
    });
    return NextResponse.json({ ok: true });
  }

  const v = validateOrgSettings(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const updated = await prisma.organization.update({
    where: { id: org.id },
    data: { ...v.data, offices: v.data.offices as unknown as object },
  });
  return NextResponse.json(updated);
}
