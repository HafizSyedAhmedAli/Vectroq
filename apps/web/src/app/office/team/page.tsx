import { prisma } from "@vectroq/db";
import { SiteFooter } from "@/components/SiteFooter";
import { TeamPanel } from "@/components/TeamPanel";
import { brandFromOrg } from "@/lib/brand";
import { isRole } from "@/lib/auth/roles";
import { requirePage } from "@/lib/org";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const { org, user } = await requirePage("OWNER");
  const [members, invites] = await Promise.all([
    prisma.membership.findMany({
      where: { organizationId: org.id },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: {
        organizationId: org.id,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <>
      <main className="mx-auto min-h-[calc(100vh-72px)] max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-extrabold text-brand-black">Team</h1>
        <p className="mt-2 text-sm text-stone-500">
          Owners manage everything. Estimators work on projects, drawings and
          rates. Viewers are read-only.
        </p>
        <div className="mt-8">
          <TeamPanel
            members={members
              .filter((m) => isRole(m.role))
              .map((m) => ({
                id: m.id,
                name: m.user.name,
                email: m.user.email,
                role: m.role as "OWNER" | "ESTIMATOR" | "VIEWER",
                isYou: m.userId === user.id,
              }))}
            invites={invites
              .filter((i) => isRole(i.role))
              .map((i) => ({
                id: i.id,
                email: i.email,
                role: i.role as "OWNER" | "ESTIMATOR" | "VIEWER",
                expiresLabel: i.expiresAt.toLocaleDateString("en-PK", {
                  dateStyle: "medium",
                }),
              }))}
          />
        </div>
      </main>
      <SiteFooter brand={brandFromOrg(org)} />
    </>
  );
}
