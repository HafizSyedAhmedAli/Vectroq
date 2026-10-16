import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vectroq/db";
import { getCurrentOrg } from "@/lib/org";
import { validateOrgSettings } from "@/lib/org-settings";

export async function PATCH(req: NextRequest) {
  const org = await getCurrentOrg();
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
