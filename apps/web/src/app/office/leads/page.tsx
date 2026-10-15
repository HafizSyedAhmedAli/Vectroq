// apps/web/src/app/office/leads/page.tsx
import Link from "next/link";
import { ArrowRight, House, Users } from "lucide-react";
import { prisma, type Lead } from "@tmcc/db";
import { ConvertLeadForm } from "@/components/ConvertLeadForm";
import { SiteFooter } from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

const SOURCE_LABELS: Record<string, string> = {
  FORM: "Web form",
  WHATSAPP: "WhatsApp",
  FACEBOOK: "Facebook Page",
};

// FR-2/5: every WhatsApp/Form contact is logged as a Lead; office turns one
// into a Project once the design-brief meeting has happened (SRS §3 steps
// 3-5). This lists Leads that haven't been converted yet — the "projects:
// none" filter is what keeps a Lead off this list once ConvertLeadForm
// below has created a Project for it.
export default async function OfficeLeadsPage() {
  const leads = await prisma.lead.findMany({
    where: { projects: { none: {} } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <main className="relative min-h-[calc(100vh-72px)] overflow-hidden bg-gradient-to-b from-stone-50 to-white pb-32">
        {/* Hero picture, faded into the page (same treatment as the home page) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/demo.jpg"
          alt=""
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 hidden h-[430px] w-[46%] object-cover opacity-90 lg:block [mask-image:linear-gradient(to_right,transparent,black_45%)]"
        />

        <div className="relative mx-auto max-w-6xl px-4 pt-12 sm:px-6">
          {/* Heading */}
          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wide text-brand">
            <span className="h-0.5 w-8 bg-brand" />
            Leads management
          </div>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight text-brand-black sm:text-5xl">
                Leads Awaiting a <span className="text-brand">Project</span>
              </h1>
              <p className="mt-4 max-w-2xl text-base text-stone-500">
                {leads.length} lead{leads.length === 1 ? "" : "s"} — create a
                project once you&apos;ve met the client and finalized the brief
                (SRS §3 step 4).
              </p>
            </div>
            <Link
              href="/office"
              className="relative z-10 inline-flex items-center gap-2 rounded-xl border border-brand/30 bg-white/80 px-4 py-2.5 text-sm font-semibold text-brand shadow-sm backdrop-blur transition hover:border-brand hover:bg-white"
            >
              View projects <ArrowRight className="size-4" />
            </Link>
          </div>

          {/* Leads */}
          <div className="mx-auto mt-12 max-w-5xl">
            {leads.length === 0 ? (
              <div className="rounded-3xl border border-stone-200/70 bg-white/90 p-10 text-center shadow-[0_10px_40px_-12px_rgba(35,31,30,0.15)]">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <Users className="size-6" />
                </div>
                <p className="mt-4 text-lg font-semibold text-brand-black">
                  No leads waiting
                </p>
                <p className="mt-1 text-sm text-stone-500">
                  Every lead so far has a project.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {leads.map((lead: Lead) => (
                  <section
                    key={lead.id}
                    className="rounded-3xl border border-stone-200/70 bg-white/95 p-6 shadow-[0_10px_40px_-12px_rgba(35,31,30,0.15)] backdrop-blur sm:p-8"
                  >
                    <div className="mb-7 flex items-center gap-4">
                      <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-md shadow-brand/30">
                        <Users className="size-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xl font-bold text-brand-black">
                          {lead.name}
                        </p>
                        <p className="text-sm text-stone-500">
                          {lead.contact} ·{" "}
                          {SOURCE_LABELS[lead.source] ?? lead.source} ·{" "}
                          {lead.createdAt.toLocaleDateString("en-PK")}
                        </p>
                      </div>
                    </div>
                    <ConvertLeadForm
                      leadId={lead.id}
                      defaultCity={lead.city}
                      defaultModel={lead.model}
                      defaultCategory={lead.category}
                    />
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Corner decorations from the design */}
        <div className="pointer-events-none absolute bottom-6 left-6 hidden items-center gap-3 rounded-2xl border border-stone-200/70 bg-white/90 px-4 py-3 shadow-sm backdrop-blur md:flex">
          <House className="size-7 text-brand" />
          <p className="text-[11px] leading-tight text-stone-500">
            Better Homes
            <br />
            Stronger Communities
          </p>
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-6 right-6 hidden md:block"
        >
          <span className="absolute -top-16 right-10 h-24 w-px rotate-[35deg] bg-brand/60" />
          <span className="absolute -top-14 right-6 h-20 w-px rotate-[35deg] bg-brand/40" />
          <div className="grid grid-cols-2 gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="size-2.5 rounded-[3px] bg-brand" />
            ))}
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
