import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Prisma } from "@vectroq/db";
import { parseCsrCsv } from "@vectroq/rate-cards";
import {
  canonicalCityName,
  type Category,
  type RateCardItem,
} from "@vectroq/shared-types";

const CSV_PATH = path.join(process.cwd(), "data", "pakistan-2026.csv");
const CATEGORIES: Category[] = ["A", "B", "C"];

export interface SampleRateRow {
  city: string;
  category: Category;
  items: RateCardItem[];
}
export type SampleRates = SampleRateRow[];

/** Starter rates for a new company, read from the bundled sample CSV. */
export async function loadSampleRates(): Promise<SampleRates> {
  try {
    const text = (await readFile(CSV_PATH, "utf8")).replace(/^\uFEFF/, "");
    const parsed = parseCsrCsv(text);
    if (!parsed.ok) {
      console.error("Sample rates CSV is invalid:", parsed.error);
      return [];
    }
    return Object.entries(parsed.byCity).flatMap(([city, items]) => {
      const name = canonicalCityName(city);
      if (!name) return [];
      return CATEGORIES.map((category) => ({ city: name, category, items }));
    });
  } catch (err) {
    console.error("Could not load sample rates", err);
    return [];
  }
}

export async function insertSampleRates(
  tx: Prisma.TransactionClient,
  organizationId: string,
  rows: SampleRates,
) {
  if (!rows.length) return;
  const now = new Date();
  await tx.rateSet.createMany({
    data: rows.map((r) => ({
      organizationId,
      city: r.city,
      category: r.category,
      status: "APPROVED",
      origin: "csr",
      items: r.items as unknown as Prisma.InputJsonValue,
      sources: {
        document: "Sample rates (not verified)",
        year: 2026,
        importedAt: now.toISOString(),
      },
      approvedAt: now,
      approvedBy: "Vectroq sample data",
    })),
  });
}
