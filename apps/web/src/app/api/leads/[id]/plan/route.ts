import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { prisma } from "@vectroq/db";
import { guard } from "@/lib/auth/guard";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await guard("VIEWER");
  if (!g.ok) return g.res;
  const { id } = await params;

  const lead = await prisma.lead.findFirst({
    where: { id, organizationId: g.auth.org.id },
  });
  if (!lead?.planFileUrl)
    return NextResponse.json({ error: "No plan file." }, { status: 404 });

  // planFileUrl is our own stored pathname, never user input.
  const result = await get(lead.planFileUrl, {
    access: "private",
    token: process.env.PLANS_READ_WRITE_TOKEN,
  });
  if (!result || result.statusCode !== 200)
    return NextResponse.json({ error: "File not found." }, { status: 404 });

  const filename = (lead.planFileName ?? "plan").replace(/[^\w.\- ]+/g, "_");
  return new Response(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
