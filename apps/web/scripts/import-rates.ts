// apps/web/scripts/import-rates.ts
// Usage (from repo root):
//   DATABASE_URL=... pnpm --filter @tmcc/web exec tsx scripts/import-rates.ts \
//     data/rates/sindh-2026.csv --document "Sindh CSR" --year 2026 --by "Office" [--categories A,B,C]
import { readFileSync } from "node:fs";
import { prisma } from "@tmcc/db";
import type { Category } from "@tmcc/shared-types";
import { importCsr } from "../src/lib/import-csr";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const file = process.argv[2];
  const document = arg("document");
  const year = Number(arg("year"));
  const approvedBy = arg("by");
  const categories = (arg("categories") ?? "A,B,C")
    .split(",")
    .map((c) => c.trim())
    .filter((c): c is Category => ["A", "B", "C"].includes(c));

  if (!file || !document || !Number.isInteger(year) || !approvedBy) {
    console.error(
      'Usage: import-rates.ts <file.csv> --document "<name>" --year <yyyy> --by "<name>" [--categories A,B,C]',
    );
    process.exit(1);
  }

  const result = await importCsr({
    csv: readFileSync(file, "utf8"),
    document,
    year,
    categories,
    approvedBy,
  });

  if (!result.ok) {
    console.error(`Import failed: ${result.error}`);
    process.exit(1);
  }
  console.log(
    `Imported ${result.imported} rate sets for: ${result.cities.join(", ")}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
