import { NextRequest, NextResponse } from "next/server";
import {
  validateLeadIntake,
  validatePlanFile,
  type LeadIntakeInput,
} from "@vectroq/lead-intake";
import { canonicalCityName } from "@vectroq/shared-types";
import { estimateLead } from "@vectroq/rate-cards";
import { prisma } from "@vectroq/db";
import { getLiveRateCard } from "@/lib/rate-sets";
import { pickLeadData, readLeadRequest } from "@/lib/lead-request";
import { savePlanFile } from "@/lib/save-plan-file";
import { getOrgBySlug } from "@/lib/org";

export async function POST(req: NextRequest) {
  const { body, planFile } = await readLeadRequest(req);
  const raw = (body ?? {}) as Partial<LeadIntakeInput> & { orgSlug?: unknown };

  if (typeof raw.orgSlug !== "string") {
    return NextResponse.json({ error: "Missing company." }, { status: 400 });
  }

  const org = await getOrgBySlug(raw.orgSlug);

  if (!org) {
    return NextResponse.json({ error: "Unknown company." }, { status: 404 });
  }

  const input = raw as Partial<LeadIntakeInput>;
  const result = validateLeadIntake(input);
  const planFileError = planFile ? validatePlanFile(planFile) : null;
  if (!result.valid || planFileError) {
    return NextResponse.json(
      {
        errors: {
          ...result.errors,
          ...(planFileError ? { planFile: planFileError } : {}),
        },
      },
      { status: 400 },
    );
  }

  const city = canonicalCityName(input.city) ?? input.city!.trim();

  let lead = await prisma.lead.create({
    data: pickLeadData({ ...(input as LeadIntakeInput), city }, org.id),
  });

  if (planFile) {
    try {
      const planFileUrl = await savePlanFile(lead.id, planFile);
      lead = await prisma.lead.update({
        where: { id: lead.id },
        data: { planFileUrl, planFileName: planFile.name },
      });
    } catch (err) {
      console.error("Could not save lead plan file", err);
    }
  }

  const rateCard = await getLiveRateCard(org.id, city, input.category!).catch(
    () => null,
  );
  const estimate = estimateLead({
    model: input.model!,
    rateCard: rateCard ?? undefined,
  });

  return NextResponse.json({ ...lead, estimate }, { status: 201 });
}
