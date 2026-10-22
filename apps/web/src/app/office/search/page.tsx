import Link from "next/link";
import {
  ArrowRight,
  FolderOpen,
  Inbox,
  MapPin,
  Search,
  Tag,
} from "lucide-react";
import { prisma } from "@vectroq/db";
import { categoryName, resolveOrgRules } from "@vectroq/shared-types";
import { requirePage } from "@/lib/org";
import { formatShort } from "@/lib/boq-format";

export const dynamic = "force-dynamic";

const LIMIT = 20;

const card =
  "rounded-2xl border border-stone-200/70 bg-white p-5 shadow-[0_10px_40px_-12px_rgba(15,23,42,0.10)] sm:p-6";

function Section({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className={card}>
      <h2 className="flex items-center gap-3 text-lg font-bold text-brand-black">
        <span className="grid size-9 place-items-center rounded-lg bg-brand/10 text-brand">
          {icon}
        </span>
        {title}
        <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-stone-600">
          {count}
        </span>
      </h2>
      <div className="mt-4">
        {count === 0 ? (
          <p className="text-sm text-stone-400">No matches.</p>
        ) : (
          <ul className="divide-y divide-stone-100">{children}</ul>
        )}
      </div>
    </section>
  );
}

const row =
  "flex flex-wrap items-center gap-3 py-3 hover:bg-stone-50/70 -mx-2 px-2 rounded-lg";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { org } = await requirePage();
  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  const rules = resolveOrgRules(org.rules);

  if (!q) {
    return (
      <main className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-stone-50 to-white pb-16">
        <div className="mx-auto max-w-4xl px-4 pt-12 sm:px-6">
          <h1 className="text-3xl font-extrabold text-brand-black">Search</h1>
          <p className="mt-3 text-sm text-stone-500">
            Type a client name, phone number or city in the search bar above.
          </p>
        </div>
      </main>
    );
  }

  const has = (field: string) => ({
    [field]: { contains: q, mode: "insensitive" as const },
  });

  const [projects, leads, rateSets] = await Promise.all([
    prisma.project.findMany({
      where: {
        organizationId: org.id,
        OR: [{ lead: has("name") }, { lead: has("contact") }, has("city")],
      },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
      include: { lead: true, cadFile: { select: { boq: true } } },
    }),
    prisma.lead.findMany({
      where: {
        organizationId: org.id,
        OR: [has("name"), has("contact"), has("city")],
      },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
      include: { projects: { select: { id: true }, take: 1 } },
    }),
    prisma.rateSet.findMany({
      where: {
        OR: [{ organizationId: org.id }, { organizationId: null }],
        status: "APPROVED",
        ...has("city"),
      },
      select: { city: true, category: true, organizationId: true },
      take: 200,
    }),
  ]);

  // one row per city, listing its categories and whether they are the company's own
  const cities = new Map<string, { cats: Set<string>; own: boolean }>();
  for (const r of rateSets) {
    const c = cities.get(r.city) ?? { cats: new Set<string>(), own: false };
    c.cats.add(r.category);
    if (r.organizationId) c.own = true;
    cities.set(r.city, c);
  }
  const cityRows = [...cities.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  return (
    <main className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-stone-50 to-white pb-16">
      <div className="mx-auto max-w-4xl px-4 pt-10 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-brand/10 text-brand">
            <Search className="size-5" />
          </span>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-brand-black">
              Results for “{q}”
            </h1>
            <p className="text-sm text-stone-500">
              {projects.length + leads.length + cityRows.length} matches across
              projects, leads and rates.
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          <Section
            icon={<FolderOpen className="size-4" />}
            title="Projects"
            count={projects.length}
          >
            {projects.map((p) => {
              const total = (p.cadFile?.boq as { total?: number } | null)
                ?.total;
              return (
                <li key={p.id}>
                  <Link href={`/office/${p.id}`} className={row}>
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="truncate text-sm font-semibold text-brand-black">
                        {p.lead.name}
                      </p>
                      <p className="truncate text-xs text-stone-500">
                        {p.city} · Category {p.category} ·{" "}
                        {categoryName(rules, p.category)}
                      </p>
                    </div>
                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">
                      {p.status.replace("_", " ")}
                    </span>
                    <span className="w-28 text-right text-sm font-semibold text-brand-black">
                      {total ? formatShort(total) : "—"}
                    </span>
                    <ArrowRight className="size-4 text-stone-400" />
                  </Link>
                </li>
              );
            })}
          </Section>

          <Section
            icon={<Inbox className="size-4" />}
            title="Leads"
            count={leads.length}
          >
            {leads.map((l) => {
              const projectId = l.projects[0]?.id;
              return (
                <li key={l.id}>
                  <Link
                    href={projectId ? `/office/${projectId}` : "/office/leads"}
                    className={row}
                  >
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="truncate text-sm font-semibold text-brand-black">
                        {l.name}
                      </p>
                      <p className="truncate text-xs text-stone-500">
                        {l.contact} · {l.city} ·{" "}
                        {l.createdAt.toLocaleDateString("en-PK", {
                          dateStyle: "medium",
                        })}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        projectId
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {projectId ? "Has project" : "Awaiting project"}
                    </span>
                    <ArrowRight className="size-4 text-stone-400" />
                  </Link>
                </li>
              );
            })}
          </Section>

          <Section
            icon={<Tag className="size-4" />}
            title="Rates by city"
            count={cityRows.length}
          >
            {cityRows.map(([city, c]) => (
              <li key={city}>
                <Link
                  href={`/office/rates?city=${encodeURIComponent(city)}`}
                  className={row}
                >
                  <MapPin className="size-4 shrink-0 text-brand" />
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="truncate text-sm font-semibold text-brand-black">
                      {city}
                    </p>
                    <p className="text-xs text-stone-500">
                      Categories {[...c.cats].sort().join(", ")}
                    </p>
                  </div>
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">
                    {c.own ? "Your rates" : "Default rates"}
                  </span>
                  <ArrowRight className="size-4 text-stone-400" />
                </Link>
              </li>
            ))}
          </Section>
        </div>
      </div>
    </main>
  );
}
