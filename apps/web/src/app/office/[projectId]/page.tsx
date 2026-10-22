// apps/web/src/app/office/[projectId]/page.tsx
import {
  categoryName,
  modelName,
  resolveOrgRules,
} from "@vectroq/shared-types";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Box, Tag } from "lucide-react";
import type { BOQResult, Category, Geometry } from "@vectroq/shared-types";
import { prisma } from "@vectroq/db";
import { ProjectWorkspace } from "@/components/ProjectWorkspace";
import { ProjectDetailsCard } from "@/components/ProjectDetailsCard";
import { getCurrentOrg, requirePage } from "@/lib/org";
import { ShareLinkPanel } from "@/components/ShareLinkPanel";
import { hasRole } from "@/lib/auth/roles";
import { BrandHero } from "@/components/BrandHero";

export const dynamic = "force-dynamic";

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
  const auth = await requirePage();

  const org = auth.org;

  const { projectId } = await params;

  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: org.id },
    include: { lead: true, cadFile: true },
  });

  if (!project) notFound();

  const approvedRates = await prisma.rateSet.findFirst({
    where: {
      OR: [{ organizationId: org.id }, { organizationId: null }],
      city: project.city,
      category: project.category,
      status: "APPROVED",
    },
    orderBy: [
      { organizationId: { sort: "asc", nulls: "last" } },
      { approvedAt: "desc" },
    ],
  });

  const rules = resolveOrgRules(org.rules);
  const livingFloor = rules.categories[project.category as Category]
    ?.marbleInLiving
    ? "marble"
    : "tile";
  const modelLabel = `Model ${project.model} — ${modelName(rules, project.model)}`;

  return (
    <>
      <main className="relative min-h-[calc(100vh-72px)] overflow-hidden bg-gradient-to-b from-stone-50 to-white pb-16">
        <BrandHero />

        <div className="relative mx-auto max-w-6xl px-4 pt-10 sm:px-6">
          <Link
            href="/office"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-dark"
          >
            <ArrowLeft className="size-4" />
            Back to Projects
          </Link>

          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-4xl font-extrabold tracking-tight text-brand-black sm:text-5xl">
                {project.lead.name}
              </h1>
              <p className="mt-2 text-sm text-stone-500">
                {project.city} · {modelLabel} · Category {project.category}
              </p>
              <p className="mt-1 font-mono text-xs text-stone-400">
                Project ID: {project.id}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {project.cadFile && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-black">
                  <Box className="size-3.5 text-brand" /> 3D model
                </span>
              )}
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                  STATUS_STYLES[project.status] ?? "bg-stone-100 text-stone-600"
                }`}
              >
                {project.status.replace("_", " ")}
              </span>
              {project.cadFile?.boq && (
                <a
                  href="#boq-section"
                  className="inline-flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow-md shadow-brand/25 hover:bg-brand-dark"
                >
                  Jump to BOQ
                </a>
              )}
            </div>
          </div>

          {/* Rates applied */}
          <div className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-stone-200/70 bg-white px-5 py-4 shadow-sm">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-white">
              <Tag className="size-5" />
            </span>
            <div className="min-w-0 flex-1 basis-60">
              <p className="text-sm font-semibold text-brand-black">
                Rates applied
              </p>
              <p className="text-xs text-stone-500">
                Category {project.category} ·{" "}
                {categoryName(rules, project.category)} ·{" "}
                {approvedRates
                  ? `market rates approved ${approvedRates.approvedAt?.toISOString().slice(0, 10)} by ${approvedRates.approvedBy}`
                  : "no rates loaded for this city yet"}
              </p>
            </div>
            <Link
              href="/office/rates"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-brand/40 bg-white px-4 text-sm font-semibold text-brand hover:bg-brand/5"
            >
              Manage rates <ArrowRight className="size-4" />
            </Link>
          </div>

          {project.cadFile?.boq && hasRole(auth.role, "ESTIMATOR") && (
            <div className="mt-4">
              <ShareLinkPanel
                projectId={project.id}
                initial={
                  project.shareToken && project.shareExpiresAt
                    ? {
                        token: project.shareToken,
                        expiresAt: project.shareExpiresAt.toISOString(),
                        label: project.shareExpiresAt.toLocaleDateString(
                          "en-PK",
                          {
                            dateStyle: "medium",
                          },
                        ),
                      }
                    : null
                }
              />
            </div>
          )}

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
              initialFileName={project.cadFile?.fileName ?? null}
              updatedLabel={
                project.cadFile
                  ? project.cadFile.updatedAt.toLocaleDateString("en-PK", {
                      dateStyle: "medium",
                    })
                  : null
              }
              livingFloor={livingFloor}
            />
          </div>
        </div>
      </main>
    </>
  );
}
