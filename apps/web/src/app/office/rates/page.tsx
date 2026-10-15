// apps/web/src/app/office/rates/page.tsx
import { BadgeCheck, MapPin, ShieldCheck } from "lucide-react";
import { prisma } from "@tmcc/db";
import type { RateCardItem } from "@tmcc/shared-types";
import { SiteFooter } from "@/components/SiteFooter";
import { RateSetReviewPanel } from "@/components/RateSetReviewPanel";
import type {
  ApprovedRateSet,
  DraftRateSet,
  RateSources,
} from "@/lib/rate-set-types";

export const dynamic = "force-dynamic";

export default async function OfficeRatesPage() {
  const [drafts, approved] = await Promise.all([
    prisma.rateSet.findMany({
      where: { status: "DRAFT" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.rateSet.findMany({
      where: { status: "APPROVED" },
      orderBy: { approvedAt: "desc" },
    }),
  ]);

  // Dates are formatted here, on the server, so the client component only
  // receives plain strings (no locale/timezone hydration mismatch).
  const label = (d: Date | null) =>
    d ? d.toLocaleDateString("en-PK", { dateStyle: "medium" }) : "—";

  const initialDrafts: DraftRateSet[] = drafts.map((d) => ({
    id: d.id,
    city: d.city,
    category: d.category,
    origin: d.origin,
    createdAt: d.createdAt.toISOString(),
    createdLabel: label(d.createdAt),
    items: d.items as unknown as RateCardItem[],
    sources: d.sources as unknown as RateSources | null,
  }));

  const approvedSets: ApprovedRateSet[] = approved.map((a) => ({
    id: a.id,
    city: a.city,
    category: a.category,
    origin: a.origin,
    approvedBy: a.approvedBy ?? "—",
    approvedLabel: label(a.approvedAt),
    approvedAt: a.approvedAt?.toISOString() ?? null,
    items: a.items as unknown as RateCardItem[],
    sources: a.sources as unknown as RateSources | null,
  }));

  return (
    <>
      <main className="relative min-h-[calc(100vh-72px)] overflow-hidden bg-gradient-to-b from-stone-50 to-white pb-16">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/demo.jpg"
          alt=""
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 hidden h-[430px] w-[46%] object-cover opacity-90 lg:block [mask-image:linear-gradient(to_right,transparent,black_45%)]"
        />

        <div className="relative mx-auto max-w-6xl px-4 pt-12 sm:px-6">
          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wide text-brand-black">
            <span className="h-0.5 w-8 bg-brand" />
            Rates <span className="text-brand">&amp; Pricing</span>
          </div>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-brand-black sm:text-5xl">
            Approved <span className="text-brand">Rates</span>
          </h1>
          <p className="mt-4 max-w-md text-base text-stone-500">
            A BOQ only uses approved rates. Rates come from an imported
            Composite Schedule of Rates (CSR) or from drafts entered and
            approved by office.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-stone-600">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-4" /> Verified &amp; Trusted
            </span>
            <span className="hidden h-4 w-px bg-stone-300 sm:block" />
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4" /> City-wise rates
            </span>
            <span className="hidden h-4 w-px bg-stone-300 sm:block" />
            <span className="flex items-center gap-1.5">
              <BadgeCheck className="size-4" /> {approvedSets.length} approved
              set{approvedSets.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="mt-10">
            <RateSetReviewPanel
              initialDrafts={initialDrafts}
              approved={approvedSets}
            />
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
