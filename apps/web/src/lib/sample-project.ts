import { prisma } from "@vectroq/db";
import type { Organization } from "@vectroq/db";
import { parseDxf } from "@vectroq/cad-parser";
import { estimateFromGeometry } from "@vectroq/rate-cards";
import { resolveOrgRules, type BOQResult } from "@vectroq/shared-types";
import { getRateCardWithBasis, RateUnavailableError } from "@/lib/rate-sets";
import { toRateBasisInfo } from "@/lib/rate-basis";
import { buildUnitState, evaluateUnitGate } from "@/lib/cad-unit";

export const SAMPLE_PLAN_PATH = "/samples/sample-house-plan.dxf";

// The bundled sample declares no $INSUNITS, but it is genuinely millimetres: its
// own annotations read "SIMPLE 12m x 10m HOUSE PLAN", "12000 mm OVERALL WIDTH" and
// "10000 mm OVERALL DEPTH" and its walls span 12000 x 10000. We know this, so we
// confirm it explicitly (a person did not, but the file's owner is us).
const SAMPLE_PLAN_UNIT = "millimetre" as const;

/**
 * Creates a sample lead + project, parses the bundled sample plan, and prices
 * it. If no rates exist yet, the project is left at CAD_UPLOADED.
 */
export async function createSampleProject(org: Organization, origin: string) {
  const res = await fetch(`${origin}${SAMPLE_PLAN_PATH}`);
  if (!res.ok) throw new Error("Sample plan is missing.");
  const rules = resolveOrgRules(org.rules);
  const { geometry, meta } = parseDxf(await res.text(), {
    construction: rules.construction,
    confirmedUnit: SAMPLE_PLAN_UNIT,
  });
  const unitState = buildUnitState(meta);

  const city = "Karachi";
  const lead = await prisma.lead.create({
    data: {
      organizationId: org.id,
      name: "Sample Client",
      contact: "0300-0000000",
      city,
      model: 2,
      category: "B",
      houseType: "House",
      floors: 1,
      bedrooms: 2,
      consent: true,
      source: "SAMPLE",
    },
  });
  const project = await prisma.project.create({
    data: {
      organizationId: org.id,
      leadId: lead.id,
      model: 2,
      category: "B",
      city,
      status: "CAD_UPLOADED",
      meetingNotes: "Sample project created from the bundled demo plan.",
    },
  });
  await prisma.cadFile.create({
    data: {
      projectId: project.id,
      fileName: "sample-house-plan.dxf",
      format: "dxf",
      geometry: geometry as unknown as object,
      // Persisted like any upload. No dxfBlobKey: the sample is not stored in
      // blob storage (re-upload the DXF to change its unit).
      unit: unitState as unknown as object,
    },
  });

  let priced = false;
  try {
    // Same confirmation rule as /finalize: never price an unconfirmed drawing.
    if (!evaluateUnitGate(unitState).ok) return { projectId: project.id, priced };
    const resolved = await getRateCardWithBasis(org.id, city, "B", rules);
    const result = estimateFromGeometry({
      geometry,
      model: 2,
      rateCard: resolved.card,
      rules,
    });
    if (result) {
      const boq: BOQResult = {
        ...result,
        rateBasis: toRateBasisInfo(resolved.basis, city),
      };
      await prisma.cadFile.update({
        where: { projectId: project.id },
        data: { boq: boq as unknown as object },
      });
      await prisma.project.update({
        where: { id: project.id },
        data: { status: "FINALIZED" },
      });
      priced = true;
    }
  } catch (err) {
    if (!(err instanceof RateUnavailableError)) throw err;
  }
  return { projectId: project.id, priced };
}