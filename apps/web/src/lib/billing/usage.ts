import { prisma } from "@vectroq/db";
import { monthStart, type Usage } from "./limits";

export async function getUsage(organizationId: string): Promise<Usage> {
  const [projectsThisMonth, members, invites] = await Promise.all([
    prisma.project.count({
      where: { organizationId, createdAt: { gte: monthStart() } },
    }),
    prisma.membership.count({ where: { organizationId } }),
    prisma.invitation.count({
      where: { organizationId, acceptedAt: null, expiresAt: { gt: new Date() } },
    }),
  ]);
  return { projectsThisMonth, seatsUsed: members + invites };
}