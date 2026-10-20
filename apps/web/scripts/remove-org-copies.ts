import { prisma } from "@vectroq/db";

async function main() {
  const r = await prisma.rateSet.deleteMany({
    where: { organizationId: { not: null }, approvedBy: "Vectroq sample data" },
  });
  console.log(`Removed ${r.count} per-org copies of the old sample rates.`);
}
main().finally(() => prisma.$disconnect());
