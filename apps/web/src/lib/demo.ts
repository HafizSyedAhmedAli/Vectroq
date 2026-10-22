import { prisma } from "@vectroq/db";

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
}
