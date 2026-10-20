// apps/web/scripts/import-rates.ts
// Usage (from repo root):
//   Shared default library:
//     pnpm --filter @vectroq/web exec tsx scripts/import-rates.ts data/pakistan-2026.csv \
//       --document "Vectroq default rates" --year 2026 --by "Vectroq" --shared
//   One company's own rates:
//     ... --org <slug> --document "Regional CSR" --year 2026 --by "Office"
import { readFileSync } from "node:fs";
import { prisma } from "@vectroq/db";
import type { Category } from "@vectroq/shared-types";
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
      'Usage: import-rates.ts <file.csv> --document "<name>" --year <yyyy> --by "<name>" [--shared | --org <slug>] [--categories A,B,C]',
    );
    process.exit(1);
  }

  const shared = process.argv.includes("--shared");
  let organizationId: string | null = null;

  if (!shared) {
    const orgSlug = arg("org") ?? "demo";
    const org = await prisma.organization.findUnique({
      where: { slug: orgSlug },
    });
    if (!org) {
      console.error(`Organization "${orgSlug}" not found.`);
      process.exit(1);
    }
    organizationId = org.id;
  }

  const result = await importCsr({
    organizationId,
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
    `Imported ${result.imported} rate sets${shared ? " (shared library)" : ""} for: ${result.cities.join(", ")}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
