import { renderBoqPdf } from "@/lib/boq-pdf";
import { brandFromOrg } from "@/lib/brand";
import { prisma } from "@vectroq/db";
import type { BOQResult, Geometry } from "@vectroq/shared-types";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const MODEL_LABELS: Record<number, string> = {
  1: "Model 1 - Land & Build, Then Sell",
  2: "Model 2 - Construction on Client's Plot",
  3: "Model 3 - Client's Plot & Client's Construction Cost",
};

async function fetchLogo(url: string | null): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id: projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { lead: true, cadFile: true, organization: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (!project.cadFile?.boq) {
    return NextResponse.json(
      { error: "No BOQ has been calculated for this project yet" },
      { status: 404 },
    );
  }

  const brand = brandFromOrg(project.organization!);
  const boq = project.cadFile.boq as unknown as BOQResult;
  const geometry = project.cadFile.geometry as unknown as Geometry;
  const areaSqFt = Math.round(geometry.rooms.reduce((s, r) => s + r.area, 0));

  const pdf = await renderBoqPdf({
    brand,
    boq,
    logo: await fetchLogo(brand.logoUrl),
    clientName: project.lead.name,
    contact: project.lead.contact,
    city: project.city,
    category: project.category,
    engagement: MODEL_LABELS[project.model] ?? `Model ${project.model}`,
    areaSqFt,
    dateLabel: new Date().toLocaleDateString("en-PK", { dateStyle: "long" }),
  });

  const safeName =
    project.lead.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") ||
    "project";

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="BOQ-${safeName}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
