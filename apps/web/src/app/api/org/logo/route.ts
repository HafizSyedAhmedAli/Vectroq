import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@vectroq/db";
import { getCurrentOrg } from "@/lib/org";
import { guard } from "@/lib/auth/guard";

const MAX_BYTES = 1024 * 1024;

export async function POST(req: NextRequest) {
  const g = await guard("OWNER"); // minimum role from the table
  if (!g.ok) return g.res;
  const org = g.auth.org;
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a file." }, { status: 400 });
  }
  // PNG/JPG only: the BOQ PDF renderer cannot embed other formats.
  if (!["image/png", "image/jpeg"].includes(file.type)) {
    return NextResponse.json(
      { error: "Logo must be a PNG or JPG." },
      { status: 400 },
    );
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Logo must be under 1 MB." },
      { status: 400 },
    );
  }

  const ext = file.type === "image/png" ? "png" : "jpg";
  const blob = await put(`org-logos/${org.id}.${ext}`, file, {
    access: "public", // branding is meant to be public
    addRandomSuffix: true,
  });
  await prisma.organization.update({
    where: { id: org.id },
    data: { logoUrl: blob.url },
  });
  return NextResponse.json({ logoUrl: blob.url });
}
