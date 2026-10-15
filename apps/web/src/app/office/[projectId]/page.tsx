// apps/web/src/app/office/[projectId]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { BOQResult, Geometry } from "@tmcc/shared-types";
import { prisma } from "@tmcc/db";
import { ProjectWorkspace } from "@/components/ProjectWorkspace";
import { ProjectDetailsCard } from "@/components/ProjectDetailsCard";
import { SiteFooter } from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

const MODEL_LABELS: Record<number, string> = {
  1: "Model 1 — Land & Build, Then Sell",
  2: "Model 2 — Construction on Client's Plot",
  3: "Model 3 — Client's Plot & Client's Construction Cost",
};

const STATUS_STYLES: Record<string, string> = {
  NEW: "bg-stone-100 text-stone-600",
  CAD_UPLOADED: "bg-amber-100 text-amber-700",
  FINALIZED: "bg-green-100 text-green-700",
};

export default async function OfficeProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { lead: true, cadFile: true },
  });

  if (!project) notFound();

  const approvedRates = await prisma.rateSet.findFirst({
    where: {
      city: project.city,
      category: project.category,
      status: "APPROVED",
    },
    orderBy: { approvedAt: "desc" },
  });

  const modelLabel = MODEL_LABELS[project.model] ?? `Model ${project.model}`;

  return (
    <>
      <main className="relative min-h-[calc(100vh-72px)] overflow-hidden bg-gradient-to-b from-stone-50 to-white pb-16">
        {/* Hero picture, faded into the page (same treatment as the other office pages) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/demo.jpg"
          alt=""
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 hidden h-[430px] w-[46%] object-cover opacity-90 lg:block [mask-image:linear-gradient(to_right,transparent,black_45%)]"
        />

        <div className="relative mx-auto max-w-6xl px-4 pt-10 sm:px-6">
          <Link
            href="/office"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-dark"
          >
            <ArrowLeft className="size-4" />
            Back to Projects
          </Link>

          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-brand-black sm:text-5xl">
            {project.lead.name}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-stone-500">
            <span>
              Project: <span className="font-mono">{project.id}</span>
            </span>
            <span>·</span>
            <span>{project.city}</span>
            <span>·</span>
            <span>{modelLabel}</span>
            <span>·</span>
            <span>Category {project.category}</span>
            <span>·</span>
            <span className="flex items-center gap-1.5">
              Status:
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  STATUS_STYLES[project.status] ?? "bg-stone-100 text-stone-600"
                }`}
              >
                {project.status.replace("_", " ")}
              </span>
            </span>
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200/70 bg-white/95 px-5 py-3.5 text-sm shadow-[0_10px_40px_-12px_rgba(35,31,30,0.12)] backdrop-blur">
            <p className="text-stone-600">
              <span className="font-semibold text-brand-black">
                Rates applied:
              </span>{" "}
              {project.city} · Category {project.category} ·{" "}
              {approvedRates
                ? `market rates approved ${approvedRates.approvedAt?.toISOString().slice(0, 10)} by ${approvedRates.approvedBy}`
                : "live market rates are searched when the first BOQ is calculated"}
            </p>
            <Link
              href="/office/rates"
              className="inline-flex items-center gap-2 rounded-xl border border-brand/30 bg-white px-4 py-2 text-sm font-semibold text-brand transition hover:border-brand"
            >
              Manage rates <ArrowRight className="size-4" />
            </Link>
          </div>

          {project.meetingNotes && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/90 px-5 py-3 text-sm text-amber-900">
              <span className="font-semibold">Meeting notes:</span>{" "}
              {project.meetingNotes}
            </div>
          )}

          <div className="mt-6">
            <ProjectWorkspace
              projectId={project.id}
              initialGeometry={
                project.cadFile
                  ? (project.cadFile.geometry as unknown as Geometry)
                  : null
              }
              initialBoq={
                project.cadFile?.boq
                  ? (project.cadFile.boq as unknown as BOQResult)
                  : null
              }
            />
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
