import { prisma } from "@vectroq/db";
import { Users } from "lucide-react";
import { TeamPanel } from "@/components/TeamPanel";
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
    <main className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-blue-50/40 to-white pb-16">
      <div className="mx-auto max-w-5xl px-4 pt-10 sm:px-6">
        <div className="flex items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-blue-50 text-brand">
            <Users className="size-6" />
          </span>
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-brand-black">
              Team
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              Owners manage everything. Estimators work on projects, drawings
              and rates. Viewers are read-only.
            </p>
          </div>
        </div>

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
      </div>
    </main>
  );
}
