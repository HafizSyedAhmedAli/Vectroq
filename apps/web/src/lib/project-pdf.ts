import type { BOQResult, Geometry } from "@vectroq/shared-types";
import {
  categoryName,
  modelName,
  resolveNotes,
  resolveOrgRules,
} from "@vectroq/shared-types";
import type { Prisma } from "@vectroq/db";
import { renderBoqPdf } from "@/lib/boq-pdf";
import { brandFromOrg } from "@/lib/brand";
import { planOf } from "./billing/plans";

export type ProjectForPdf = Prisma.ProjectGetPayload<{
  include: { lead: true; cadFile: true; organization: true };
}>;

async function fetchLogo(url: string | null): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

export async function projectPdfResponse(
  project: ProjectForPdf,
): Promise<Response> {
  if (!project.cadFile?.boq) {
    return Response.json(
      { error: "No BOQ has been calculated for this project yet" },
      { status: 404 },
    );
  }
  const brand = brandFromOrg(project.organization!);
  const rules = resolveOrgRules(project.organization!.rules);
  const notes = resolveNotes(rules);
  const boq = project.cadFile.boq as unknown as BOQResult;
  const geometry = project.cadFile.geometry as unknown as Geometry;
  const areaSqFt = Math.round(geometry.rooms.reduce((s, r) => s + r.area, 0));

  const pdf = await renderBoqPdf({
    brand,
    platformBranding: !planOf(project.organization!).removeBranding,
    boq,
    logo: await fetchLogo(brand.logoUrl),
    clientName: project.lead.name,
    contact: project.lead.contact,
    city: project.city,
    category: `${project.category} (${categoryName(rules, project.category)})`,
    engagement: `Model ${project.model} - ${modelName(rules, project.model)}`,
    assumptions: notes.assumptions,
    exclusions: notes.exclusions,
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
