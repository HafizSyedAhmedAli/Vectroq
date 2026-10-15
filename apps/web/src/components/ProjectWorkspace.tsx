"use client";

import { useState } from "react";
import type { BOQResult, Geometry } from "@tmcc/shared-types";
import { CadReviewPanel } from "@/components/CardReviewPanel";
import { ViewerPanel } from "@/components/ViewerPanel";
import { ProjectStepper } from "@/components/ProjectStepper";

interface ProjectWorkspaceProps {
  projectId: string;
  initialGeometry: Geometry | null;
  initialBoq: BOQResult | null;
}

export function ProjectWorkspace({
  projectId,
  initialGeometry,
  initialBoq,
}: ProjectWorkspaceProps) {
  const [geometry, setGeometry] = useState<Geometry | null>(initialGeometry);
  const [hasBoq, setHasBoq] = useState(initialBoq !== null);

  return (
    <div className="space-y-8">
      <ProjectStepper hasCad={geometry !== null} hasBoq={hasBoq} />

      <section>
        <h2 className="text-lg font-semibold text-brand-black mb-3">
          Drawing &amp; cost estimate
        </h2>
        <CadReviewPanel
          projectId={projectId}
          initialGeometry={initialGeometry}
          initialBoq={initialBoq}
          onGeometryChange={setGeometry}
          onBoqChange={(b) => setHasBoq(b !== null)}
        />
      </section>

      <div className="pt-2">
        <ViewerPanel geometry={geometry} />
      </div>
    </div>
  );
}
