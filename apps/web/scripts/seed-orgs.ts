import { prisma } from "@vectroq/db";

const ORGS = [
  {
    slug: "demo",
    name: "Demo Builders",
    tagline: "Priced estimates in minutes",
    primaryColor: "#2563EB",
  },
  {
    slug: "acme-builders",
    name: "Acme Builders",
    tagline: "Built to last",
    primaryColor: "#16A34A",
  },
];

async function main() {
  for (const o of ORGS) {
    await prisma.organization.upsert({
      where: { slug: o.slug },
      update: {},
      create: o,
    });
  }
  console.log("Seeded:", ORGS.map((o) => o.slug).join(", "));
}

main().finally(() => prisma.$disconnect());
