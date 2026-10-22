// apps/web/src/components/ViewerPanel.tsx
"use client";
import dynamic from "next/dynamic";
import type { Geometry } from "@vectroq/shared-types";
import { LivingFloor } from "./viewer/materials";

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
  livingFloor,
}: {
  geometry: Geometry | null;
  bare?: boolean;
  livingFloor?: LivingFloor;
}) {
  return (
    <section className={bare ? "" : "border-t border-stone-200 pt-5"}>
      {!bare && (
        <h3 className="text-sm font-semibold text-brand-black mb-2">
          3D Model
        </h3>
      )}
      {geometry ? (
        <HouseViewer geometry={geometry} livingFloor={livingFloor} />
      ) : (
        <p className="text-sm text-stone-400">Upload a CAD file above first.</p>
      )}
    </section>
  );
}
