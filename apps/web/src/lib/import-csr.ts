// apps/web/src/lib/import-csr.ts
import { parseCsrCsv } from "@tmcc/rate-cards";
import {
  canonicalCityName,
  CORE_MATERIAL_TYPES,
  type Category,
  type RateCardItem,
} from "@tmcc/shared-types";
import { prisma } from "@tmcc/db";
import { CSR_CSV_MAX_BYTES } from "./rate-set-types";

export interface ImportCsrInput {
  csv: string;
  document: string; // e.g. "Sindh CSR"
  year: number;
  categories: Category[];
  approvedBy: string;
}

export type ImportCsrResult =
  | { ok: true; imported: number; cities: string[] }
  | { ok: false; error: string };

/**
 * One import creates an APPROVED rate set per city per category and
 * supersedes the previous CSR set for those cities. It is all-or-nothing:
 * any problem in the file rejects the whole import before anything is saved.
 */
export async function importCsr(
  input: ImportCsrInput,
): Promise<ImportCsrResult> {
  const csv = input.csv.replace(/^\uFEFF/, ""); // Excel adds a BOM
  if (!csv.trim()) return { ok: false, error: "The CSV is empty." };
  if (csv.length > CSR_CSV_MAX_BYTES) {
    return { ok: false, error: "The CSV is larger than 1 MB." };
  }
  const categories = [...new Set(input.categories)];
  if (categories.length === 0) {
    return { ok: false, error: "Choose at least one category." };
  }

  const parsed = parseCsrCsv(csv);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const byCity = new Map<string, RateCardItem[]>();
  const unknown: string[] = [];
  const duplicated: string[] = [];
  for (const [city, items] of Object.entries(parsed.byCity)) {
    const canonical = canonicalCityName(city);
    if (!canonical) {
      unknown.push(city);
    } else if (byCity.has(canonical)) {
      duplicated.push(canonical);
    } else {
      byCity.set(canonical, items);
    }
  }

  if (unknown.length) {
    return {
      ok: false,
      error: `Unknown city name(s): ${unknown.join(", ")}. Use the names from the city list (for example "Nawabshah").`,
    };
  }
  if (duplicated.length) {
    return {
      ok: false,
      error: `${duplicated.join(", ")} appears more than once under different names. Keep one set of rows per city.`,
    };
  }

  // A set without the core materials is ignored by BOQs, so reject it here
  // instead of letting it fail later with a confusing "no rates" error.
  const incomplete = [...byCity.entries()].flatMap(([city, items]) => {
    const have = new Set(items.map((i) => i.itemType));
    const missing = CORE_MATERIAL_TYPES.filter((t) => !have.has(t));
    return missing.length ? [`${city} (missing ${missing.join(", ")})`] : [];
  });
  if (incomplete.length) {
    return {
      ok: false,
      error: `Every city needs brick, cement, sand and steelMaterial. Incomplete: ${incomplete.join("; ")}.`,
    };
  }

  const cities = [...byCity.keys()].sort((a, b) => a.localeCompare(b, "en"));
  const now = new Date();
  const sources = {
    document: input.document,
    year: input.year,
    importedAt: now.toISOString(),
  };

  await prisma.$transaction([
    prisma.rateSet.updateMany({
      where: {
        city: { in: cities },
        category: { in: categories },
        status: "APPROVED",
        origin: "csr",
      },
      data: { status: "SUPERSEDED" },
    }),
    prisma.rateSet.createMany({
      data: cities.flatMap((city) =>
        categories.map((category) => ({
          city,
          category,
          status: "APPROVED",
          origin: "csr",
          items: byCity.get(city) as unknown as object,
          sources,
          approvedAt: now,
          approvedBy: input.approvedBy,
        })),
      ),
    }),
  ]);

  return { ok: true, imported: cities.length * categories.length, cities };
}
