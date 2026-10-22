// apps/web/src/app/client/[projectId]/page.tsx
import { BoqTable } from "@/components/BoqTable";
import { BrandLogo } from "@/components/BrandLogo";
import { DownloadPdfButton } from "@/components/DownloadPdfButton";
import { SiteFooter } from "@/components/SiteFooter";
import { ViewerPanel } from "@/components/ViewerPanel";
import { formatPkr } from "@/lib/boq-format";
import { brandFromOrg, brandStyle } from "@/lib/brand";
import { prisma } from "@vectroq/db";
import {
  BOQResult,
  Category,
  categoryName,
  Geometry,
  modelName,
  resolveNotes,
  resolveOrgRules,
} from "@vectroq/shared-types";
import {
  Home,
  Info,
  Layers,
  MapPin,
  Phone,
  Receipt,
  Ruler,
  ShieldCheck,
  Tag,
  User,
} from "lucide-react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

// NOTE: this page shows the full BOQ line items, the client's phone number
// and a PDF download. There is still no auth (access control isn't built),
// so anyone with the link can see it.

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
      <span className="grid size-11 shrink-0 place-items-center rounded-full border border-stone-200 bg-white text-brand-black">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-stone-400">{label}</p>
        <p className="text-sm font-semibold leading-snug text-brand-black">
          {children}
        </p>
      </div>
    </div>
  );
}

const card =
  "rounded-3xl border border-stone-200/70 bg-white/95 shadow-[0_10px_40px_-12px_rgba(35,31,30,0.12)] backdrop-blur";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ClientProjectPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const project = await prisma.project.findFirst({
    where: { shareToken: token, shareExpiresAt: { gt: new Date() } },
    include: { lead: true, cadFile: true, organization: true },
  });

  if (!project) notFound();
  const brand = brandFromOrg(project.organization!);

  if (!project) notFound();

  const boq = project.cadFile?.boq
    ? (project.cadFile.boq as unknown as BOQResult)
    : null;

  const geometry = project.cadFile?.geometry
    ? (project.cadFile.geometry as unknown as Geometry)
    : null;
  const areaSqFt = geometry
    ? Math.round(geometry.rooms.reduce((s, r) => s + r.area, 0))
    : null;

  const rules = resolveOrgRules(project.organization!.rules);
  const livingFloor = rules.categories[project.category as Category]
    ?.marbleInLiving
    ? "marble"
    : "tile";
  const notes = resolveNotes(rules);
  const modelLabel = modelName(rules, project.model);

  return (
    <div style={brandStyle(brand)}>
      {/* Header */}
      <header className="print:hidden border-b border-stone-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-4">
          <BrandLogo brand={brand} priority />
          {brand.contact.phone && (
            <a
              href={`tel:${brand.contact.phone.replace(/\s/g, "")}`}
              className="flex items-center gap-2 text-sm font-semibold text-brand-black"
            >
              <Phone className="size-4 text-brand" />
              {brand.contact.phone}
            </a>
          )}
        </div>
      </header>

      <main className="relative overflow-hidden bg-gradient-to-b from-stone-50 to-white pb-16">
        <div className="relative mx-auto max-w-6xl px-4 pt-10 sm:px-6">
          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-4xl font-extrabold tracking-tight text-brand-black sm:text-5xl">
              Your House, <span className="text-brand">Visualized</span>
            </h1>
            <p className="mt-3 flex items-center gap-2 text-sm text-stone-600">
              <MapPin className="size-4 text-brand" />
              {project.city} · {modelLabel}
            </p>
          </div>

          {/* Gallery + project details */}
          <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
            <section className={`${card} p-4 sm:p-5`}>
              {geometry ? (
                <ViewerPanel
                  geometry={geometry}
                  bare
                  livingFloor={livingFloor}
                  category={project.category as Category}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/demo.jpg"
                  alt="House preview"
                  className="w-full h-auto block rounded-2xl"
                />
              )}
            </section>

            <aside className={`${card} p-6`}>
              <div className="mb-5 flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-red-50 text-brand">
                  <Home className="size-5" />
                </span>
                <h2 className="font-bold text-brand-black">Project Details</h2>
              </div>

              <div className="divide-y divide-stone-100">
                <DetailRow icon={<User className="size-5" />} label="Client">
                  {project.lead.name}
                </DetailRow>
                <DetailRow icon={<MapPin className="size-5" />} label="City">
                  {project.city}
                </DetailRow>
                <DetailRow icon={<Tag className="size-5" />} label="Category">
                  Model {project.model} — {modelLabel}
                </DetailRow>
                <DetailRow icon={<Phone className="size-5" />} label="Contact">
                  {project.lead.contact}
                </DetailRow>
                <DetailRow
                  icon={<Layers className="size-5" />}
                  label="Material category"
                >
                  Category {project.category} ·{" "}
                  {categoryName(rules, project.category)}
                </DetailRow>
                {areaSqFt !== null && (
                  <DetailRow
                    icon={<Ruler className="size-5" />}
                    label="Covered area"
                  >
                    {areaSqFt.toLocaleString("en-PK")} sq ft
                  </DetailRow>
                )}
              </div>

              {boq && (
                <DownloadPdfButton
                  variant="card"
                  href={`/api/share/${token}/boq-pdf`}
                />
              )}
            </aside>
          </div>

          {/* Cost summary */}
          <section className={`${card} mt-6 p-5 sm:p-7`}>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-red-50 text-brand">
                  <Receipt className="size-6" />
                </span>
                <div>
                  <h2 className="text-xl font-bold text-brand-black">
                    Cost Summary
                  </h2>
                  {boq && (
                    <p className="mt-1 max-w-md text-sm text-stone-500">
                      Based on your approved drawing and Category{" "}
                      {project.category} materials in {project.city}. Final
                      contract price is confirmed after site inspection.
                    </p>
                  )}
                </div>
              </div>

              {boq && (
                <div className="rounded-2xl bg-red-50 px-6 py-4 text-right">
                  <p className="text-sm text-brand">Total Estimated Cost</p>
                  <p className="mt-0.5 text-2xl font-extrabold text-brand">
                    {formatPkr(boq.total)}
                  </p>
                </div>
              )}
            </div>

            {boq ? (
              <BoqTable boq={boq} />
            ) : (
              <p className="rounded-xl border border-dashed border-stone-300 px-4 py-10 text-center text-sm text-stone-400">
                Your final cost estimate is being finalized by our office and
                will appear here shortly.
              </p>
            )}

            {boq && (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-stone-50 p-5">
                  <h3 className="mb-3 flex items-center gap-2.5 text-sm font-semibold text-brand-black">
                    <ShieldCheck className="size-5 text-brand-black" />
                    Basis of estimate
                  </h3>
                  <ul className="list-disc space-y-1 pl-9 text-xs leading-relaxed text-stone-500">
                    {notes.assumptions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl bg-stone-50 p-5">
                  <h3 className="mb-3 flex items-center gap-2.5 text-sm font-semibold text-brand-black">
                    <Info className="size-5 text-brand-black" />
                    Not included
                  </h3>
                  <ul className="list-disc space-y-1 pl-9 text-xs leading-relaxed text-stone-500">
                    {notes.exclusions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      <SiteFooter brand={brand} />
    </div>
  );
}
