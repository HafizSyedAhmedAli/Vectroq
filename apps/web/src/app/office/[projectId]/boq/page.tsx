// apps/web/src/app/office/[projectId]/boq/page.tsx
import { BoqTable } from "@/components/BoqTable";
import { BrandLogo } from "@/components/BrandLogo";
import { DownloadPdfButton } from "@/components/DownloadPdfButton";
import { ASSUMPTIONS, EXCLUSIONS } from "@/lib/boq-format";
import { brandFromOrg } from "@/lib/brand";
import { getCurrentOrg } from "@/lib/org";
import { prisma } from "@vectroq/db";
import type { BOQResult, Geometry } from "@vectroq/shared-types";
import {
  ArrowLeft,
  Building2,
  ClipboardList,
  Home,
  MapPin,
  Phone,
  Ruler,
  Tag,
  User
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const MODEL_LABELS: Record<number, string> = {
  1: "Model 1 — Land & Build, Then Sell",
  2: "Model 2 — Construction on Client's Plot",
  3: "Model 3 — Client's Plot & Client's Construction Cost",
};

type IconType = React.ComponentType<{ className?: string }>;

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: IconType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="size-4 mt-0.5 text-brand-black shrink-0" />
      <div>
        <p className="text-[11px] text-stone-400 leading-none mb-1">{label}</p>
        <p className="text-sm font-medium text-brand-black leading-tight">
          {value}
        </p>
      </div>
    </div>
  );
}

// Printable BOQ. "Download PDF" uses the react-pdf route; the browser
// print dialog also works and keeps the colours (see globals.css).
export default async function BoqPrintPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const org = await getCurrentOrg();
  const brand = brandFromOrg(org);
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: org.id },
    include: { lead: true, cadFile: true },
  });

  if (!project) notFound();

  const boq = project.cadFile?.boq as unknown as BOQResult | null;
  if (!boq) {
    return (
      <main className="px-4 py-12 max-w-3xl mx-auto">
        <p className="text-sm text-stone-600">
          No BOQ has been calculated for this project yet.
        </p>
        <Link href={`/office/${projectId}`} className="text-sm text-brand">
          ← Back to project
        </Link>
      </main>
    );
  }

  const geometry = project.cadFile!.geometry as unknown as Geometry;
  const area = Math.round(geometry.rooms.reduce((s, r) => s + r.area, 0));
  const today = new Date().toLocaleDateString("en-PK", { dateStyle: "long" });
  const perSqft = new Intl.NumberFormat("en-PK", {
    maximumFractionDigits: 0,
  }).format(boq.total / Math.max(area, 1));

  return (
    <main className="min-h-screen bg-stone-50 print:bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <BrandLogo brand={brand} className="h-14 w-auto mb-3" />
        <div className="absolute inset-0 bg-gradient-to-r from-stone-50 via-stone-50/90 to-stone-50/10 print:hidden" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-stone-50 to-transparent print:hidden" />

        <div className="relative max-w-5xl mx-auto px-4 pt-6 pb-10">
          <Link
            href={`/office/${projectId}`}
            className="print:hidden inline-flex items-center gap-1.5 text-sm text-brand hover:text-brand-dark mb-5"
          >
            <ArrowLeft className="size-4" /> Back to project
          </Link>

          <div className="rounded-2xl bg-white/95 backdrop-blur shadow-sm border border-stone-200 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <BrandLogo brand={brand} className="h-14 w-auto mb-3" />
                <h1 className="text-3xl font-bold text-brand-black">
                  Bill of Quantities &amp; Cost Estimate
                </h1>
                <p className="text-sm text-stone-500 mt-1">
                  Prepared on {today}
                </p>
              </div>
              <DownloadPdfButton href={`/api/projects/${projectId}/boq-pdf`} />
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-[1fr_1fr_1fr_1.2fr] items-start">
              <div className="space-y-4">
                <Info icon={User} label="Client" value={project.lead.name} />
                <Info
                  icon={Phone}
                  label="Contact"
                  value={project.lead.contact}
                />
              </div>
              <div className="space-y-4 md:border-l md:border-stone-200 md:pl-6">
                <Info icon={MapPin} label="City" value={project.city} />
                <Info
                  icon={Tag}
                  label="Engagement"
                  value={
                    MODEL_LABELS[project.model] ?? `Model ${project.model}`
                  }
                />
              </div>
              <div className="space-y-4 md:border-l md:border-stone-200 md:pl-6">
                <Info
                  icon={Building2}
                  label="Material category"
                  value={`Category ${project.category}`}
                />
                <Info
                  icon={Ruler}
                  label="Covered area"
                  value={`${area.toLocaleString("en-PK")} sq ft`}
                />
              </div>
              {(brand.offices.length > 0 ||
                brand.contact.phone ||
                brand.contact.email) && (
                <div className="flex gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 text-xs text-stone-600 leading-relaxed">
                  <MapPin className="size-4 text-brand shrink-0 mt-0.5" />
                  <div>
                    {brand.offices.map((o) => (
                      <p key={o.title}>
                        {o.title}: {o.address}
                      </p>
                    ))}
                    <p>
                      {[brand.contact.phone, brand.contact.email]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Itemized estimate */}
      <section className="max-w-5xl mx-auto px-4 -mt-2">
        <div className="rounded-2xl bg-white border border-stone-200 shadow-sm p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="flex items-center gap-2.5 text-lg font-semibold text-brand-black">
              <ClipboardList className="size-5" /> Itemized Estimate
            </h2>
            <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-4 py-1.5 text-xs text-stone-600">
              <Home className="size-3.5 text-stone-400" />
              Approx. Rs {perSqft} per sq ft (incl. tax)
            </span>
          </div>

          <BoqTable boq={boq} />

          <div className="grid md:grid-cols-2 gap-4 mt-5 break-inside-avoid">
            <section className="rounded-xl border border-stone-200 bg-stone-50/60 p-4">
              <h3 className="text-sm font-semibold text-brand-black mb-2">
                Basis of estimate
              </h3>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-stone-500">
                {ASSUMPTIONS.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </section>
            <section className="rounded-xl border border-stone-200 bg-stone-50/60 p-4">
              <h3 className="text-sm font-semibold text-brand-black mb-2">
                Not included
              </h3>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-stone-500">
                {EXCLUSIONS.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </section>
          </div>

          <div className="grid grid-cols-2 gap-16 mt-10 text-xs text-stone-500 break-inside-avoid">
            <div className="border-t border-stone-300 pt-1">
              For {brand.name}
            </div>
            <div className="border-t border-stone-300 pt-1">
              Client acceptance
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
