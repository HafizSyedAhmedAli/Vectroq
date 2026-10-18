import type { ReactNode } from "react";
import Image from "next/image";
import { Box, ClipboardList, ShieldCheck, Zap } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { platformBrand } from "@/lib/brand";

const FEATURES = [
  { icon: Zap, label: "Fast Quotations" },
  { icon: ClipboardList, label: "Accurate BOQs" },
  { icon: Box, label: "3D Visualization" },
  { icon: ShieldCheck, label: "Trusted by Professionals" },
];

// Below this height the page scrolls instead of squeezing text into the picture.
const PAGE_MIN_H = "min-h-[max(100vh,760px)]";

export function AuthShell({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main
      className={`relative ${PAGE_MIN_H} overflow-hidden bg-gradient-to-br from-white via-white to-blue-50/50`}
    >
      {/* Sky panel with the diagonal edge; the house sits at its bottom and fades upward */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 hidden w-[62%] bg-gradient-to-b from-sky-100/80 via-sky-50/70 to-white [clip-path:polygon(0_0,100%_0,84%_100%,0_100%)] lg:block"
      >
        <div
          className="absolute inset-x-0 bottom-0 h-[min(44%,460px)]"
          style={{
            WebkitMaskImage: "linear-gradient(to bottom, transparent, black 32%)",
            maskImage: "linear-gradient(to bottom, transparent, black 32%)",
          }}
        >
          <Image
            src="/login-hero.png"
            alt=""
            fill
            priority
            sizes="62vw"
            className="object-cover object-bottom"
          />
        </div>
      </div>

      <div
        className={`relative mx-auto grid ${PAGE_MIN_H} max-w-[1500px] lg:grid-cols-[1.15fr_1fr]`}
      >
        {/* Left: brand + pitch (always above the picture) */}
        <section className="relative z-10 px-6 pt-8 lg:pl-[7%] lg:pr-8 lg:pt-10">
          <BrandLogo brand={platformBrand} className="h-11 w-auto" priority />

          <div className="hidden lg:block">
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.28em] text-blue-500">
              Plan · Visualize · Build
            </p>
            <h1 className="mt-3 max-w-xl text-balance text-[44px] font-extrabold leading-[1.05] tracking-tight text-brand-black xl:text-[52px]">
              From floor plan to{" "}
              <span className="whitespace-nowrap text-brand">final quote.</span>
            </h1>
            <p className="mt-4 max-w-md text-balance text-base leading-relaxed text-stone-600 xl:text-lg">
              Upload your house plan (DXF) and turn it into a priced Bill of
              Quantities and a 3D model, in minutes, not days.
            </p>

            <ul className="mt-6 flex max-w-xl gap-6">
              {FEATURES.map(({ icon: Icon, label }) => (
                <li key={label} className="w-24">
                  <span className="grid size-11 place-items-center rounded-xl bg-white text-brand shadow-sm ring-1 ring-blue-100">
                    <Icon className="size-5" />
                  </span>
                  <span className="mt-2 block text-xs font-semibold leading-snug text-brand-black">
                    {label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="absolute bottom-8 left-[4%] hidden border-l-2 border-brand pl-3 text-sm leading-snug text-stone-600 lg:block">
            Smarter planning.
            <br />
            Better buildings.
          </p>
        </section>

        {/* Right: card */}
        <section className="relative z-10 flex items-center justify-center px-4 py-10 lg:py-16">
          <div className="w-full max-w-[480px] animate-fade-up rounded-3xl border border-stone-100 bg-white p-8 shadow-[0_24px_70px_-24px_rgba(15,23,42,0.22)] sm:p-10">
            <h2 className="text-3xl font-extrabold tracking-tight text-brand-black">
              {title}
            </h2>
            <p className="mt-2 text-[15px] text-stone-500">{subtitle}</p>
            <div className="mt-7">{children}</div>

            {footer && (
              <>
                <div className="my-6 flex items-center gap-4 text-xs font-medium text-stone-400">
                  <span className="h-px flex-1 bg-stone-200" />
                  OR
                  <span className="h-px flex-1 bg-stone-200" />
                </div>
                <p className="text-center text-sm text-stone-500">{footer}</p>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}