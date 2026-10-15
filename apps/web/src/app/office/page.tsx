// apps/web/src/app/office/page.tsx
import Link from "next/link";
import { ArrowRight, Layers } from "lucide-react";
import { prisma } from "@tmcc/db";
import { ProjectsList, type ProjectCardData } from "@/components/ProjectsList";
import { SiteFooter } from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

const pkr = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

export default async function OfficeProjectsPage() {
  const [projects, pendingLeadCount] = await Promise.all([
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: { lead: true, render: true, cadFile: true },
    }),
    prisma.lead.count({ where: { projects: { none: {} } } }),
  ]);

  // Everything is formatted here, on the server, so the client component
  // gets plain strings and can't hit a date/locale hydration mismatch.
  const cards: ProjectCardData[] = projects.map((p) => {
    const total = (p.cadFile?.boq as { total?: number } | null)?.total;
    return {
      id: p.id,
      name: p.lead.name,
      city: p.city,
      model: p.model,
      category: p.category,
      status: p.status,
      hasRender: !!p.render,
      imageUrl: p.render?.imageUrl ?? "/demo.jpg",
      createdLabel: p.createdAt.toLocaleDateString("en-PK", {
        dateStyle: "medium",
      }),
      valueLabel: total ? `Rs ${pkr.format(Math.round(total))}` : null,
    };
  });

  return (
    <>
      <main className="relative min-h-[calc(100vh-72px)] overflow-hidden bg-gradient-to-b from-stone-50 to-white pb-16">
        {/* Hero picture, faded into the page (same treatment as leads/home) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/demo.jpg"
          alt=""
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 hidden h-[430px] w-[46%] object-cover opacity-90 lg:block [mask-image:linear-gradient(to_right,transparent,black_45%)]"
        />

        <div className="relative mx-auto max-w-6xl px-4 pt-12 sm:px-6">
          {/* Heading */}
          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wide text-brand-black">
            <span className="h-0.5 w-8 bg-brand" />
            Projects
          </div>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight text-brand-black sm:text-5xl">
                Your Construction <span className="text-brand">Projects</span>
              </h1>
              <p className="mt-4 max-w-md text-base text-stone-500">
                Track and manage your ongoing and upcoming projects. Get the
                latest updates, status and key details all in one place.
              </p>
              <p className="mt-6 flex items-center gap-2 text-sm text-stone-500">
                <Layers className="size-5 text-brand-black" />
                <span>
                  <span className="font-semibold text-brand-black">
                    {projects.length}
                  </span>{" "}
                  Project{projects.length === 1 ? "" : "s"}
                </span>
              </p>
            </div>

            <Link
              href="/office/leads"
              className="relative z-10 mt-6 inline-flex items-center gap-2 rounded-xl border border-brand/30 bg-white/90 px-4 py-2.5 text-sm font-semibold text-brand shadow-sm backdrop-blur transition hover:border-brand hover:bg-white"
            >
              {pendingLeadCount} lead{pendingLeadCount === 1 ? "" : "s"}{" "}
              awaiting a project
              <ArrowRight className="size-4" />
            </Link>
          </div>

          {/* Search, filters and cards */}
          <div className="mt-10">
            <ProjectsList projects={cards} />
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
