import { Prisma, prisma } from "@vectroq/db";
import { DEFAULT_ORG_SLUG } from "@/lib/org";

export async function loadSampleRates() {
  const demo = await prisma.organization.findUnique({
    where: { slug: DEFAULT_ORG_SLUG },
  });
  return demo
    ? prisma.rateSet.findMany({
        where: { organizationId: demo.id, status: "APPROVED" },
      })
    : [];
}
export type SampleRates = Awaited<ReturnType<typeof loadSampleRates>>;

export async function insertSampleRates(
  tx: Prisma.TransactionClient,
  organizationId: string,
  rows: SampleRates,
) {
  if (!rows.length) return;
  await tx.rateSet.createMany({
    data: rows.map((r) => ({
      organizationId,
      city: r.city,
      category: r.category,
      status: "APPROVED",
      origin: r.origin,
      taxPercent: r.taxPercent,
      items: r.items as Prisma.InputJsonValue,
      sources: r.sources ?? Prisma.JsonNull,
      approvedAt: r.approvedAt,
      approvedBy: r.approvedBy,
    })),
  });
}
