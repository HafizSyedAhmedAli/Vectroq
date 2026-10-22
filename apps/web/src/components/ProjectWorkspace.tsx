"use client";

import { useState } from "react";
import Link from "next/link";
import { Box, CircleCheck, FileText, Ruler } from "lucide-react";
import type { BOQResult, Category, Geometry } from "@vectroq/shared-types";
import { CadReviewPanel } from "@/components/CardReviewPanel";
import { BoqTable } from "@/components/BoqTable";
import { ViewerPanel } from "@/components/ViewerPanel";
import { ProjectStepper } from "@/components/ProjectStepper";
import { LivingFloor } from "./viewer/materials";

interface ProjectWorkspaceProps {
  projectId: string;
  initialGeometry: Geometry | null;
  initialBoq: BOQResult | null;
  initialFileName?: string | null;
  updatedLabel?: string | null;
  livingFloor?: LivingFloor;
  category?: Category;
}

const card =
  "rounded-2xl border border-stone-200/70 bg-white p-5 shadow-[0_10px_40px_-12px_rgba(15,23,42,0.10)] sm:p-6";

function CardHeader({
  icon,
  title,
  right,
}: {
  icon: React.ReactNode;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-center gap-3 text-lg font-bold text-brand-black">
        <span className="grid size-9 place-items-center rounded-lg bg-brand/10 text-brand">
          {icon}
        </span>
        {title}
      </h2>
      {right}
    </div>
  );
}

export function ProjectWorkspace({
  projectId,
  initialGeometry,
  initialBoq,
  initialFileName = null,
  updatedLabel = null,
  livingFloor = "tile",
  category,
}: ProjectWorkspaceProps) {
  const [geometry, setGeometry] = useState<Geometry | null>(initialGeometry);
  const [boq, setBoq] = useState<BOQResult | null>(initialBoq);

  return (
    <div className="space-y-6">
      <ProjectStepper hasCad={geometry !== null} hasBoq={boq !== null} />

      <section className={card}>
        <CardHeader
          icon={<Ruler className="size-4" />}
          title="Drawing & cost estimate"
          right={
            updatedLabel && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
                <CircleCheck className="size-3.5" /> Last updated {updatedLabel}
              </span>
            )
          }
        />
        <CadReviewPanel
          projectId={projectId}
          initialGeometry={initialGeometry}
          initialBoq={initialBoq}
          initialFileName={initialFileName}
          showBoq={false}
          onGeometryChange={setGeometry}
          onBoqChange={setBoq}
        />
      </section>

      <section id="boq-section" className={`${card} scroll-mt-24`}>
        <CardHeader
          icon={<FileText className="size-4" />}
          title="Bill of Quantities"
          right={
            boq && (
              <Link
                href={`/office/${projectId}/boq`}
                target="_blank"
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                Print / Save PDF
              </Link>
            )
          }
        />
        {boq ? (
          <BoqTable boq={boq} />
        ) : (
          <p className="rounded-xl border border-dashed border-stone-300 px-4 py-10 text-center text-sm text-stone-400">
            No BOQ yet. Upload a drawing, check the rooms, then press “Calculate
            BOQ”.
          </p>
        )}
      </section>

      <section className={card}>
        <CardHeader icon={<Box className="size-4" />} title="3D Model" />
        <ViewerPanel
          geometry={geometry}
          bare
          livingFloor={livingFloor}
          category={category}
        />
      </section>
    </div>
  );
}
