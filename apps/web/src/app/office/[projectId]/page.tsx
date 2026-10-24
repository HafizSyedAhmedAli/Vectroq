// apps/web/src/app/office/[projectId]/page.tsx
import {
  categoryName,
  modelName,
  resolveOrgRules,
} from "@vectroq/shared-types";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Box,
  BriefcaseBusiness,
  CalendarDays,
  Home,
  MapPin,
  Tag,
} from "lucide-react";
import type { ReactNode } from "react";
import type { BOQResult, Category, Geometry } from "@vectroq/shared-types";
import { prisma } from "@vectroq/db";
import { ProjectWorkspace } from "@/components/ProjectWorkspace";
import { CompanyIllustration } from "@/components/CompanyIllustration";
import { requirePage } from "@/lib/org";
import { ShareLinkPanel } from "@/components/ShareLinkPanel";
import { hasRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  NEW: { label: "New", cls: "bg-stone-100 text-stone-600" },
  CAD_UPLOADED: { label: "CAD uploaded", cls: "bg-amber-100 text-amber-700" },
  FINALIZED: { label: "Finalized", cls: "bg-green-100 text-green-700" },
};

function Meta({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-stone-400 [&_svg]:size-4">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-stone-500">{label}</p>
        <p className="break-words text-sm font-medium leading-snug text-brand-black">
          {children}
        </p>
      </div>
    </div>
  );
}

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
  const status = STATUS[project.status] ?? {
    label: project.status,
    cls: "bg-stone-100 text-stone-600",
  };

  return (
    <main className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-stone-50 to-white pb-16">
      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
        <Link
          href="/office"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-dark"
        >
          <ArrowLeft className="size-4" />
          Back to Projects
        </Link>

        {/* Header */}
        <header className="mt-4 grid items-center gap-6 lg:grid-cols-[1fr_340px]">
          <div className="flex items-start gap-5">
            <span className="grid size-20 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand">
              <Home className="size-10" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-4xl font-extrabold tracking-tight text-brand-black">
                {project.lead.name}
              </h1>
              <div className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                <Meta icon={<MapPin />} label="Location">
                  {project.city}
                </Meta>
                <Meta icon={<BriefcaseBusiness />} label="Project type">
                  {modelName(rules, project.model)}
                </Meta>
                <Meta icon={<Tag />} label="Category">
                  {project.category} · {categoryName(rules, project.category)}
                </Meta>
                <Meta icon={<CalendarDays />} label="Created">
                  {project.createdAt.toLocaleDateString("en-PK", {
                    dateStyle: "medium",
                  })}
                </Meta>
              </div>
            </div>
          </div>

          <div className="relative">
            <CompanyIllustration className="h-36" />
            {project.cadFile && (
              <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-brand-black shadow-sm">
                <Box className="size-3.5 text-brand" /> 3D model
              </span>
            )}
            <span
              className={`absolute right-3 top-3 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${status.cls}`}
            >
              {status.label}
            </span>
          </div>
        </header>

        {/* Rates applied */}
        <div className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-brand/15 bg-brand/5 px-5 py-4">
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
                ? `Rates approved ${approvedRates.approvedAt?.toISOString().slice(0, 10)} by ${approvedRates.approvedBy}`
                : "No rates loaded for this city yet"}
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
                        { dateStyle: "medium" },
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
            category={project.category as Category}
          />
        </div>
      </div>
    </main>
  );
}
