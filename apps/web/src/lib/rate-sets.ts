import { prisma } from "@vectroq/db";
import { categoryLabelMap, resolveOrgRules } from "@vectroq/shared-types";
import { withFixedLabour } from "@vectroq/rate-cards";
import {
  canonicalCityName,
  CORE_MATERIAL_TYPES,
  searchPlacesFor,
  type Category,
  type OrgRules,
  type RateCard,
  type RateCardItem,
} from "@vectroq/shared-types";

export class RateSetError extends Error {
  constructor(public code: "NOT_FOUND" | "NOT_DRAFT") {
    super(code);
  }
}

export class RateUnavailableError extends Error {
  constructor(
    public city: string,
    public category: Category,
    public reason: string,
  ) {
    super(`No rates loaded for ${city} (Category ${category}): ${reason}`);
    this.name = "RateUnavailableError";
  }
}

export interface RateBasis {
  place: string;
  isFallback: boolean;
  origin: string; // "csr" | "manual"
  sources: unknown;
}

const placeName = (label: string) => label.split(/\s*[(,]/)[0].trim();

async function findApproved(
  organizationId: string,
  place: string,
  category: Category,
) {
  // The org's own sets sort first (NULL = shared library sorts last),
  // newest first within each group.
  const rows = await prisma.rateSet.findMany({
    where: {
      OR: [{ organizationId }, { organizationId: null }],
      city: { equals: place, mode: "insensitive" },
      category,
      status: "APPROVED",
      origin: { in: ["csr", "manual"] },
    },
    orderBy: [
      { organizationId: { sort: "asc", nulls: "last" } },
      { approvedAt: "desc" },
    ],
  });
  for (const row of rows) {
    const items = row.items as unknown as RateCardItem[];
    const have = new Set(items.map((i) => i.itemType));
    if (CORE_MATERIAL_TYPES.every((t) => have.has(t))) return { row, items };
  }
  return null;
}

export async function getRateCardWithBasis(
  organizationId: string,
  city: string,
  category: Category,
  rules?: OrgRules,
): Promise<{ card: RateCard; basis: RateBasis }> {
  const cleanCity = canonicalCityName(city) ?? city.trim();
  const ladder = [...new Set(searchPlacesFor(cleanCity).map(placeName))].filter(
    (p) => p && !/^pakistan/i.test(p),
  );

  for (const place of ladder) {
    const hit = await findApproved(organizationId, place, category);
    if (!hit) continue;
    return {
      card: withFixedLabour(
        { city: cleanCity, category, items: hit.items },
        rules,
      ),
      basis: {
        place,
        isFallback: place.toLowerCase() !== cleanCity.toLowerCase(),
        origin: hit.row.origin,
        sources: hit.row.sources,
      },
    };
  }

  throw new RateUnavailableError(
    cleanCity,
    category,
    `no rates for ${ladder.join(", ")}. Import a rate schedule or add rates on the Rates page`,
  );
}

export async function getLiveRateCard(
  organizationId: string,
  city: string,
  category: Category,
  rules?: OrgRules,
): Promise<RateCard> {
  return (await getRateCardWithBasis(organizationId, city, category, rules))
    .card;
}

export async function approveRateSet(
  organizationId: string,
  id: string,
  approvedBy: string,
  items?: RateCardItem[],
) {
  return prisma.$transaction(async (tx) => {
    const target = await tx.rateSet.findFirst({
      where: { id, organizationId },
    });
    if (!target) throw new RateSetError("NOT_FOUND");
    if (target.status !== "DRAFT") throw new RateSetError("NOT_DRAFT");

    await tx.rateSet.updateMany({
      where: {
        organizationId,
        city: target.city,
        category: target.category,
        status: "APPROVED",
      },
      data: { status: "SUPERSEDED" },
    });
    return tx.rateSet.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedBy,
        ...(items ? { items: items as unknown as object } : {}),
      },
    });
  });
}

export async function rejectRateSet(organizationId: string, id: string) {
  return prisma.rateSet.updateMany({
    where: { id, organizationId, status: "DRAFT" },
    data: { status: "REJECTED" },
  });
}
