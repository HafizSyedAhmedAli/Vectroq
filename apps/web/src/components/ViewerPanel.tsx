// apps/web/src/components/ViewerPanel.tsx
"use client";
import dynamic from "next/dynamic";
import type { Geometry } from "@tmcc/shared-types";

const HouseViewer = dynamic(
  () => import("./HouseViewer").then((m) => m.HouseViewer),
  {
    ssr: false,
    loading: () => <p className="text-sm text-stone-400">Loading 3D model…</p>,
  },
);

export function ViewerPanel({
  geometry,
  bare = false,
}: {
  geometry: Geometry | null;
  bare?: boolean;
}) {
  return (
    <section className={bare ? "" : "border-t border-stone-200 pt-5"}>
      {!bare && (
        <h3 className="text-sm font-semibold text-brand-black mb-2">
          3D Model
        </h3>
      )}
      {geometry ? (
        <HouseViewer geometry={geometry} />
      ) : (
        <p className="text-sm text-stone-400">Upload a CAD file above first.</p>
      )}
    </section>
  );
}
