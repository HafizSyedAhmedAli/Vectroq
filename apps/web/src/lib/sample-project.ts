import { prisma } from "@vectroq/db";
import type { Organization } from "@vectroq/db";
import { parseDxf } from "@vectroq/cad-parser";
import { estimateFromGeometry } from "@vectroq/rate-cards";
import { resolveOrgRules, type BOQResult } from "@vectroq/shared-types";
import { getRateCardWithBasis, RateUnavailableError } from "@/lib/rate-sets";
import { toRateBasisInfo } from "@/lib/rate-basis";
import { buildUnitState, evaluateUnitGate } from "@/lib/cad-unit";
import { commitBoqAtRevision } from "@/lib/cad-revision";

export const SAMPLE_PLAN_PATH = "/samples/sample-house-plan.dxf";

// The bundled sample declares no $INSUNITS, but it is genuinely millimetres: its
// own annotations read "SIMPLE 12m x 10m HOUSE PLAN", "12000 mm OVERALL WIDTH" and
// "10000 mm OVERALL DEPTH". We confirm that explicitly, but only AFTER checking
// the actual file still says so (see verifySamplePlanUnit): a changed fixture
// must never turn into a confirmed wrong-scale BOQ.
export const SAMPLE_PLAN_UNIT = "millimetre" as const;

export type SampleUnitCheck = { ok: true } | { ok: false; reason: string };

/**
 * Parses the sample WITHOUT a confirmed unit and checks that the parser itself
 * reads it as millimetres at a plausible size: header millimetres, or the single
 * plausible candidate, with no implausibility warning.
 */
export function verifySamplePlanUnit(
  dxfText: string,
  construction: ReturnType<typeof resolveOrgRules>["construction"],
): SampleUnitCheck {
  let meta;
  try {
    ({ meta } = parseDxf(dxfText, { construction }));
  } catch (err) {
    return { ok: false, reason: `sample plan did not parse: ${String(err)}` };
  }
  const u = meta.unit;
  if (u.unit !== SAMPLE_PLAN_UNIT)
    return { ok: false, reason: `parser reads the sample as ${u.unit ?? "unknown"}, not ${SAMPLE_PLAN_UNIT}` };
  if (u.source !== "header" && u.source !== "plausibility")
    return { ok: false, reason: `unexpected unit source ${u.source}` };
  const plausible = (u.candidates ?? []).filter((c) => c.plausible);
  if (u.source === "plausibility" && !(plausible.length === 1 && plausible[0].unit === SAMPLE_PLAN_UNIT))
    return { ok: false, reason: "millimetres is not the only plausible reading of the sample" };
  if (meta.warnings.some((w) => w.code === "UNIT_HEADER_IMPLAUSIBLE" || w.code === "UNIT_AMBIGUOUS"))
    return { ok: false, reason: "sample size is implausible or ambiguous" };
  return { ok: true };
}

/**
 * Creates a sample lead + project, parses the bundled sample plan, and prices
 * it. If no rates exist yet, the project is left at CAD_UPLOADED.
 */
export async function createSampleProject(org: Organization, origin: string) {
  const res = await fetch(`${origin}${SAMPLE_PLAN_PATH}`);
  if (!res.ok) throw new Error("Sample plan is missing.");
  const rules = resolveOrgRules(org.rules);
  const dxfText = await res.text();
  const check = verifySamplePlanUnit(dxfText, rules.construction);
  if (!check.ok) {
    // Fail safe: do not confirm. The sample is stored with its own unconfirmed
    // unit state, so the gate blocks pricing until a person chooses the unit.
    console.error("Bundled sample plan failed unit verification:", check.reason);
  }
  const { geometry, meta } = parseDxf(dxfText, {
    construction: rules.construction,
    ...(check.ok ? { confirmedUnit: SAMPLE_PLAN_UNIT } : {}),
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
      // Same atomic, revision-checked write as /finalize (a new row is revision 0).
      await commitBoqAtRevision(project.id, 0, boq);
      priced = true;
    }
  } catch (err) {
    if (!(err instanceof RateUnavailableError)) throw err;
  }
  return { projectId: project.id, priced };
}