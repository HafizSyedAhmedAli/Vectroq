import { prisma } from "@tmcc/db";
import { withFixedLabour } from "@tmcc/rate-cards";
import {
  canonicalCityName,
  CORE_MATERIAL_TYPES,
  searchPlacesFor,
  type Category,
  type RateCard,
  type RateCardItem,
} from "@tmcc/shared-types";

export class RateSetError extends Error {
  constructor(public code: "NOT_FOUND" | "NOT_DRAFT") {
    super(code);
  }
}

// Thrown when no CSR / office-approved rates exist for the city or any
// nearby hub. There is deliberately no AI or placeholder fallback.
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
  /** Place whose rates were actually used. */
  place: string;
  /** True when `place` is not the project's own city. */
  isFallback: boolean;
  origin: string; // "csr" | "manual"
  sources: unknown;
}

// "Nawabshah (also called Benazirabad), Sindh" -> "Nawabshah"
const placeName = (label: string) => label.split(/\s*[(,]/)[0].trim();

async function findApproved(place: string, category: Category) {
  const row = await prisma.rateSet.findFirst({
    where: {
      city: { equals: place, mode: "insensitive" },
      category,
      status: "APPROVED",
      origin: { in: ["csr", "manual"] }, // never old AI-generated sets
    },
    orderBy: { approvedAt: "desc" },
  });
  if (!row) return null;
  const items = row.items as unknown as RateCardItem[];
  const have = new Set(items.map((i) => i.itemType));
  if (!CORE_MATERIAL_TYPES.every((t) => have.has(t))) return null;
  return { row, items };
}

export async function getRateCardWithBasis(
  city: string,
  category: Category,
): Promise<{ card: RateCard; basis: RateBasis }> {
  const cleanCity = canonicalCityName(city) ?? city.trim();
  const ladder = [...new Set(searchPlacesFor(cleanCity).map(placeName))].filter(
    (p) => p && !/^pakistan/i.test(p),
  );

  for (const place of ladder) {
    const hit = await findApproved(place, category);
    if (!hit) continue;
    return {
      card: withFixedLabour({ city: cleanCity, category, items: hit.items }),
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
    `no CSR data for ${ladder.join(", ")}. Import the CSR or enter rates manually on the Rates page`,
  );
}

/** Kept under the old name so existing routes/tests keep working. */
export async function getLiveRateCard(
  city: string,
  category: Category,
): Promise<RateCard> {
  return (await getRateCardWithBasis(city, category)).card;
}

export async function approveRateSet(
  id: string,
  approvedBy: string,
  items?: RateCardItem[],
) {
  return prisma.$transaction(async (tx) => {
    const target = await tx.rateSet.findUnique({ where: { id } });
    if (!target) throw new RateSetError("NOT_FOUND");
    if (target.status !== "DRAFT") throw new RateSetError("NOT_DRAFT");

    await tx.rateSet.updateMany({
      where: {
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

export async function rejectRateSet(id: string) {
  return prisma.rateSet.update({ where: { id }, data: { status: "REJECTED" } });
}