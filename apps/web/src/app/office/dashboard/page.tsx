import Link from "next/link";
import {
  ArrowRight,
  CircleDollarSign,
  FolderOpen,
  Inbox,
  Tag,
  Users,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@vectroq/db";
import { requirePage } from "@/lib/org";
import { formatShort } from "@/lib/boq-format";

export const dynamic = "force-dynamic";

const STATUSES = [
  {
    key: "NEW",
    label: "New",
    bar: "bg-stone-400",
    pill: "bg-stone-100 text-stone-600",
  },
  {
    key: "CAD_UPLOADED",
    label: "CAD uploaded",
    bar: "bg-amber-500",
    pill: "bg-amber-100 text-amber-700",
  },
  {
    key: "FINALIZED",
    label: "Finalized",
    bar: "bg-green-500",
    pill: "bg-green-100 text-green-700",
  },
] as const;

const card =
  "rounded-2xl border border-stone-200/70 bg-white shadow-[0_10px_40px_-12px_rgba(15,23,42,0.10)]";

function Stat({
  href,
  icon: Icon,
  label,
  value,
  hint,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className={`${card} group p-5 transition hover:-translate-y-0.5 hover:border-brand/40`}
    >
      <span className="grid size-11 place-items-center rounded-xl bg-brand/10 text-brand">
        <Icon className="size-5" />
      </span>
      <p className="mt-4 text-sm text-stone-500">{label}</p>
      <p className="mt-1 text-3xl font-extrabold tracking-tight text-brand-black">
        {value}
      </p>
      <p className="mt-1 text-xs text-stone-400">{hint}</p>
    </Link>
  );
}

function Action({
  href,
  icon: Icon,
  title,
  text,
  external,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  text: string;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      className="group flex items-center gap-4 rounded-xl border border-stone-200 bg-white p-4 transition hover:border-brand/40 hover:bg-brand/5"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-brand-black">
          {title}
        </span>
        <span className="block truncate text-xs text-stone-500">{text}</span>
      </span>
      <ArrowRight className="size-4 text-stone-400 transition group-hover:translate-x-0.5 group-hover:text-brand" />
    </Link>
  );
}

export default async function DashboardPage() {
  const { org, user } = await requirePage();

  const [projects, pendingLeads, approvedSets] = await Promise.all([
    prisma.project.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: "desc" },
      include: { lead: true, cadFile: { select: { boq: true } } },
    }),
    prisma.lead.count({
      where: { organizationId: org.id, projects: { none: {} } },
    }),
    prisma.rateSet.count({
      where: {
        OR: [{ organizationId: org.id }, { organizationId: null }],
        status: "APPROVED",
      },
    }),
  ]);

  const totals = projects
    .map((p) => (p.cadFile?.boq as { total?: number } | null)?.total ?? 0)
    .filter((t) => t > 0);
  const totalValue = totals.reduce((s, t) => s + t, 0);

  const counts = Object.fromEntries(
    STATUSES.map((s) => [
      s.key,
      projects.filter((p) => p.status === s.key).length,
    ]),
  ) as Record<(typeof STATUSES)[number]["key"], number>;

  const recent = projects.slice(0, 5);
  const firstName = user.name.trim().split(/\s+/)[0] || "there";
  const pkr = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

  return (
    <main className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-blue-50/40 to-white pb-16">
      <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
        <h1 className="text-4xl font-extrabold tracking-tight text-brand-black">
          Welcome back, <span className="text-brand">{firstName}</span>
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          Here&apos;s what is happening at {org.name}.
        </p>

        {/* Stats */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            href="/office/leads"
            icon={Inbox}
            label="Leads awaiting a project"
            value={String(pendingLeads)}
            hint={
              pendingLeads ? "Follow up and create projects" : "All caught up"
            }
          />
          <Stat
            href="/office"
            icon={FolderOpen}
            label="Projects"
            value={String(projects.length)}
            hint={`${counts.FINALIZED} finalized`}
          />
          <Stat
            href="/office"
            icon={CircleDollarSign}
            label="Total BOQ value"
            value={totalValue ? formatShort(totalValue) : "Rs 0"}
            hint={`${totals.length} priced estimate${totals.length === 1 ? "" : "s"}`}
          />
          <Stat
            href="/office/rates"
            icon={Tag}
            label="Approved rate sets"
            value={String(approvedSets)}
            hint={
              approvedSets ? "Used for every BOQ" : "Import a rate schedule"
            }
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* Recent projects */}
          <section className={`${card} p-5 sm:p-6`}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-brand-black">
                Recent projects
              </h2>
              <Link
                href="/office"
                className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-dark"
              >
                View all <ArrowRight className="size-4" />
              </Link>
            </div>

            {recent.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-stone-300 px-4 py-10 text-center">
                <p className="text-sm font-semibold text-brand-black">
                  No projects yet
                </p>
                <p className="mt-1 text-sm text-stone-500">
                  Projects are created from leads once you have met the client.
                </p>
                <Link
                  href="/office/leads"
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark"
                >
                  Review leads <ArrowRight className="size-4" />
                </Link>
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-stone-100">
                {recent.map((p) => {
                  const total = (p.cadFile?.boq as { total?: number } | null)
                    ?.total;
                  const status = STATUSES.find((s) => s.key === p.status);
                  return (
                    <li key={p.id}>
                      <Link
                        href={`/office/${p.id}`}
                        className="flex flex-wrap items-center gap-3 py-3.5 hover:bg-stone-50/70"
                      >
                        <div className="min-w-0 flex-1 basis-40">
                          <p className="truncate text-sm font-semibold text-brand-black">
                            {p.lead.name}
                          </p>
                          <p className="truncate text-xs text-stone-500">
                            {p.city} · Category {p.category} ·{" "}
                            {p.createdAt.toLocaleDateString("en-PK", {
                              dateStyle: "medium",
                            })}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            status?.pill ?? "bg-stone-100 text-stone-600"
                          }`}
                        >
                          {status?.label ?? p.status}
                        </span>
                        <span className="w-28 text-right text-sm font-semibold text-brand-black">
                          {total ? `Rs ${pkr.format(Math.round(total))}` : "—"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <div className="space-y-6">
            {/* Pipeline */}
            <section className={`${card} p-5 sm:p-6`}>
              <h2 className="text-lg font-bold text-brand-black">
                Project pipeline
              </h2>
              {projects.length === 0 ? (
                <p className="mt-3 text-sm text-stone-500">
                  Nothing to show yet.
                </p>
              ) : (
                <>
                  <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-stone-100">
                    {STATUSES.map((s) =>
                      counts[s.key] ? (
                        <span
                          key={s.key}
                          className={s.bar}
                          style={{
                            width: `${(counts[s.key] / projects.length) * 100}%`,
                          }}
                        />
                      ) : null,
                    )}
                  </div>
                  <ul className="mt-4 space-y-2.5 text-sm">
                    {STATUSES.map((s) => (
                      <li key={s.key} className="flex items-center gap-2.5">
                        <span className={`size-2.5 rounded-full ${s.bar}`} />
                        <span className="flex-1 text-stone-600">{s.label}</span>
                        <span className="font-semibold text-brand-black">
                          {counts[s.key]}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            {/* Quick actions */}
            <section className={`${card} p-5 sm:p-6`}>
              <h2 className="text-lg font-bold text-brand-black">
                Quick actions
              </h2>
              <div className="mt-4 space-y-3">
                <Action
                  href="/office/leads"
                  icon={Inbox}
                  title="Review new leads"
                  text="Turn enquiries into projects"
                />
                <Action
                  href="/office/rates"
                  icon={Tag}
                  title="Import rates"
                  text="Load a rate schedule (CSV)"
                />
                <Action
                  href="/office/team"
                  icon={Users}
                  title="Invite your team"
                  text="Add estimators and viewers"
                />
                <Action
                  href={`/c/${org.slug}`}
                  icon={FileText}
                  title="Open your client form"
                  text={`/c/${org.slug}`}
                  external
                />
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
