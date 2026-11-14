import { prisma } from "@vectroq/db";
import { deleteCadDxf } from "@/lib/cad-dxf-store";

export const DEMO_HOURS = 24;
export const MAX_ACTIVE_DEMOS = 200;

/** Deletes expired demo companies and everything they own. */
export async function cleanupExpiredDemos() {
  const orgs = await prisma.organization.findMany({
    where: { isDemo: true, demoExpiresAt: { lt: new Date() } },
    select: { id: true },
    take: 20,
  });
  if (orgs.length === 0) return;
  const ids = orgs.map((o) => o.id);

  const members = await prisma.membership.findMany({
    where: { organizationId: { in: ids } },
    select: { userId: true },
  });
  const userIds = members.map((m) => m.userId);

  // Original DXFs live in blob storage, not the database. Collect their keys
  // first; delete them only after the rows are gone (a blob left behind by a
  // failed delete is harmless, a row pointing at a deleted blob is not).
  const blobRows = await prisma.cadFile.findMany({
    where: {
      dxfBlobKey: { not: null },
      project: { organizationId: { in: ids } },
    },
    select: { dxfBlobKey: true },
  });

  await prisma.$transaction([
    prisma.cadFile.deleteMany({
      where: { project: { organizationId: { in: ids } } },
    }),
    prisma.render.deleteMany({
      where: { project: { organizationId: { in: ids } } },
    }),
    prisma.project.deleteMany({ where: { organizationId: { in: ids } } }),
    prisma.lead.deleteMany({ where: { organizationId: { in: ids } } }),
    prisma.rateSet.deleteMany({ where: { organizationId: { in: ids } } }),
    // cascades to sessions + memberships
    prisma.user.deleteMany({
      where: { id: { in: userIds }, email: { endsWith: "@demo.invalid" } },
    }),
    prisma.organization.deleteMany({ where: { id: { in: ids } } }),
  ]);
  await Promise.all(blobRows.map((r) => deleteCadDxf(r.dxfBlobKey)));
}
