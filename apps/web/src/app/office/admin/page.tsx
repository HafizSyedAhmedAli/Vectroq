import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { prisma } from "@vectroq/db";
import { monthStart } from "@/lib/billing/limits";
import { planOf } from "@/lib/billing/plans";
import { requirePage } from "@/lib/org";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { user } = await requirePage();
  const admins = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!admins.includes(user.email.toLowerCase())) notFound();

  const [orgs, monthly] = await Promise.all([
    prisma.organization.findMany({
      where: { isDemo: false },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { _count: { select: { projects: true, memberships: true, leads: true } } },
    }),
    prisma.project.groupBy({
      by: ["organizationId"],
      where: { createdAt: { gte: monthStart() } },
      _count: { _all: true },
    }),
  ]);
  const monthMap = new Map(monthly.map((m) => [m.organizationId, m._count._all]));
  const byPlan = { FREE: 0, PRO: 0, BUSINESS: 0 } as Record<string, number>;
  for (const o of orgs) byPlan[planOf(o).id]++;

  return (
    <main className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-stone-50 to-white pb-16">
      <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
        <h1 className="flex items-center gap-3 text-3xl font-extrabold text-brand-black">
          <ShieldCheck className="size-7 text-brand" /> Platform admin
        </h1>

        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          {[
            ["Companies", orgs.length],
            ["Free", byPlan.FREE],
            ["Pro", byPlan.PRO],
            ["Business", byPlan.BUSINESS],
          ].map(([label, n]) => (
            <div key={label} className="rounded-2xl border border-stone-200 bg-white p-4">
              <p className="text-xs text-stone-500">{label}</p>
              <p className="text-3xl font-extrabold text-brand-black">{n}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-stone-200 bg-white">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-stone-50 text-xs font-semibold text-stone-500">
              <tr>
                {["Company", "Plan", "Status", "Projects (month / total)", "Members", "Leads", "Created"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => {
                const plan = planOf(o);
                const month = monthMap.get(o.id) ?? 0;
                const atLimit =
                  plan.projectsPerMonth !== null && month >= plan.projectsPerMonth;
                return (
                  <tr key={o.id} className="border-t border-stone-100">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-brand-black">{o.name}</p>
                      <p className="text-xs text-stone-400">/c/{o.slug}</p>
                    </td>
                    <td className="px-4 py-3">{plan.name}</td>
                    <td className="px-4 py-3 text-stone-500">{o.planStatus ?? "-"}</td>
                    <td className={`px-4 py-3 ${atLimit ? "font-semibold text-red-600" : ""}`}>
                      {month} / {o._count.projects}
                    </td>
                    <td className="px-4 py-3">{o._count.memberships}</td>
                    <td className="px-4 py-3">{o._count.leads}</td>
                    <td className="px-4 py-3 text-stone-500">
                      {o.createdAt.toLocaleDateString("en-PK", { dateStyle: "medium" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}