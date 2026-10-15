// apps/web/src/components/ClientGallery.tsx
"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Box, Maximize2 } from "lucide-react";

export interface GalleryImage {
  src: string;
  alt: string;
}

// Thumbnails, arrows and dots only appear when there is more than one image,
// so a project with a single render still looks clean.
export function ClientGallery({ images }: { images: GalleryImage[] }) {
  const [index, setIndex] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const many = images.length > 1;
  const current = images[index];

  const go = (delta: number) =>
    setIndex((i) => (i + delta + images.length) % images.length);

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {many && (
        <div className="order-2 flex gap-3 overflow-x-auto sm:order-1 sm:w-[84px] sm:flex-col sm:overflow-y-auto">
          {images.map((img, i) => (
            <button
              key={img.src}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show image ${i + 1}`}
              className={`size-[72px] shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 bg-stone-100 transition sm:size-[84px] ${
                i === index
                  ? "border-brand"
                  : "border-transparent hover:border-stone-300"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.src} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div
        ref={stageRef}
        className="relative order-1 flex-1 overflow-hidden rounded-2xl bg-gradient-to-b from-sky-50 to-stone-100 sm:order-2"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- renders are served from public/ and overwritten in place */}
        <img
          src={current.src}
          alt={current.alt}
          className="block aspect-[5/4] w-full object-cover"
        />

        <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-brand-black shadow-sm backdrop-blur">
          <Box className="size-3.5" />3D View
        </span>

        <button
          type="button"
          aria-label="View fullscreen"
          onClick={() => stageRef.current?.requestFullscreen?.()}
          className="absolute right-4 top-4 grid size-9 cursor-pointer place-items-center rounded-full bg-white/95 text-brand-black shadow-sm backdrop-blur transition hover:text-brand"
        >
          <Maximize2 className="size-4" />
        </button>

        {many && (
          <div className="absolute bottom-4 left-4 flex items-center gap-3">
            <button
              type="button"
              aria-label="Previous image"
              onClick={() => go(-1)}
              className="grid size-10 cursor-pointer place-items-center rounded-full bg-white text-brand-black shadow-md transition hover:text-brand"
            >
              <ArrowLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={() => go(1)}
              className="grid size-10 cursor-pointer place-items-center rounded-full bg-white text-brand-black shadow-md transition hover:text-brand"
            >
              <ArrowRight className="size-4" />
            </button>
            <div className="ml-1 flex gap-1.5">
              {images.map((img, i) => (
                <span
                  key={img.src}
                  className={`size-2 rounded-full ${
                    i === index ? "bg-brand" : "bg-white/80"
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}