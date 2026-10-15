// apps/web/src/lib/lead-request.ts
import type { LeadIntakeInput } from "@tmcc/lead-intake";

/** Accepts plain JSON, or multipart with a `data` JSON field and optional `file`. */
export async function readLeadRequest(
  req: Request,
): Promise<{ body: unknown; planFile: File | null }> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("multipart/form-data")) {
    const form = await req.formData();
    const raw = form.get("data");
    const file = form.get("file");
    let body: unknown = null;
    try {
      body = typeof raw === "string" ? JSON.parse(raw) : null;
    } catch {
      body = null;
    }
    return {
      body,
      planFile: file instanceof File && file.size > 0 ? file : null,
    };
  }
  return { body: await req.json().catch(() => null), planFile: null };
}

/** Whitelist: never spread the request body straight into Prisma. */
export function pickLeadData(input: LeadIntakeInput) {
  return {
    name: input.name.trim(),
    contact: input.contact.trim(),
    city: input.city,
    model: input.model,
    category: input.category,
    houseType: input.houseType,
    floors: input.floors,
    bedrooms: input.bedrooms,
    plotSizeSqYd: input.plotSizeSqYd,
    coveredAreaSqFt: input.coveredAreaSqFt,
    budgetRange: input.budgetRange,
    timeline: input.timeline,
    additionalNotes: input.additionalNotes?.trim() || null,
    consent: input.consent,
    source: "FORM" as const,
  };
}
