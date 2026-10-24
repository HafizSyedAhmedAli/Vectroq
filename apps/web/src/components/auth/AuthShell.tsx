import type { ReactNode } from "react";
import Image from "next/image";
import { Box, ClipboardList, ShieldCheck, Zap } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { platformBrand } from "@/lib/brand";

const FEATURES = [
  { icon: Zap, label: "Fast Quotations" },
  { icon: ClipboardList, label: "Accurate BOQs" },
  { icon: Box, label: "3D Visualization" },
  { icon: ShieldCheck, label: "Trusted by Professionals" },
];

export function AuthShell({
  title,
  subtitle,
  footer,
  children,
  themeToggle = false,
}: {
  title: string;
  subtitle: string;
  footer?: ReactNode;
  children: ReactNode;
  themeToggle?: boolean;
}) {
  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-gradient-to-br from-white via-white to-blue-50/50 dark:bg-[#050b1a] dark:from-[#050b1a] dark:via-[#050b1a] dark:to-[#050b1a]`}
    >
      {themeToggle && <ThemeToggle className="absolute right-4 top-4 z-20" />}

      {/* DARK: the edge panel with the diagonal cut */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 hidden w-[62%] [clip-path:polygon(0_0,100%_0,84%_100%,0_100%)] dark:lg:block"
      >
        <Image
          src="/login-hero-dark.jpg"
          alt=""
          fill
          priority
          sizes="62vw"
          className="object-cover object-left"
        />
        {/* Optional: subtle gradient to ensure the dark edge blends nicely */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(5,11,26,0.95)_15%,rgba(5,11,26,0.75)_45%,transparent_80%)]" />
      </div>

      {/* LIGHT: the whole image as a background, never cropped */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-[62%] [clip-path:polygon(0_0,100%_0,84%_100%,0_100%)] dark:hidden"
      >
        <Image
          src="/login-hero.jpg"
          alt=""
          fill
          priority
          sizes="62vw"
          className="object-cover object-left"
        />
        {/* Optional: subtle gradient to ensure the dark edge blends nicely */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.95)_15%,rgba(255,255,255,0.75)_45%,transparent_80%)]" />
      </div>

      <div
        className={`relative mx-auto grid min-h-screen max-w-[1500px] lg:grid-cols-[1.15fr_1fr]`}
      >
        {/* Left: brand + pitch (always above the picture) */}
        <section className="relative z-10 px-6 pt-8 lg:pl-[7%] lg:pr-8 lg:pt-10">
          <BrandLogo
            brand={platformBrand}
            className="h-11 w-auto dark:brightness-0 dark:invert"
            priority
          />

          <div className="hidden lg:block">
            <p className="mt-6 inline-block text-xs font-bold uppercase tracking-[0.28em] text-blue-500 dark:rounded-full dark:bg-blue-500/10 dark:px-3 dark:py-1 dark:text-blue-300 dark:ring-1 dark:ring-blue-400/30">
              Plan · Visualize · Build
            </p>
            <h1 className="mt-3 max-w-xl text-balance text-[44px] font-extrabold leading-[1.05] tracking-tight text-brand-black xl:text-[52px] dark:text-white">
              From floor plan to{" "}
              <span className="whitespace-nowrap text-brand dark:text-[#2f8cff]">
                final quote.
              </span>
            </h1>
            <p className="mt-4 max-w-md text-balance text-base leading-relaxed text-stone-600 xl:text-lg dark:text-slate-300">
              Upload your house plan (DXF) and turn it into a priced Bill of
              Quantities and a 3D model, in minutes, not days.
            </p>

            <ul className="mt-6 flex max-w-xl gap-6">
              {FEATURES.map(({ icon: Icon, label }) => (
                <li key={label} className="w-24">
                  <span className="grid size-11 place-items-center rounded-xl bg-white text-brand shadow-sm ring-1 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:shadow-none dark:ring-blue-400/30">
                    <Icon className="size-5" />
                  </span>
                  <span className="mt-2 block text-xs font-semibold leading-snug text-brand-black dark:text-slate-200">
                    {label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="absolute bottom-8 left-[4%] hidden border-l-2 border-brand pl-3 text-sm leading-snug text-stone-600 lg:block dark:border-blue-500 dark:text-slate-200">
            Smarter planning.
            <br />
            Better buildings.
          </p>
        </section>

        {/* Right: card */}
        <section className="relative z-10 flex items-center justify-center px-4 py-10 lg:py-16">
          <div className="w-full max-w-[480px] animate-fade-up rounded-3xl border border-stone-100 bg-white/95 p-8 shadow-[0_24px_70px_-24px_rgba(15,23,42,0.22)] sm:p-10 dark:border-blue-400/20 dark:bg-[#0b1630]/80 dark:shadow-[0_24px_80px_-20px_rgba(37,99,235,0.35)] dark:backdrop-blur">
            <h2 className="text-3xl font-extrabold tracking-tight text-brand-black dark:text-white">
              {title}
            </h2>
            <p className="mt-2 text-[15px] text-stone-500 dark:text-slate-400">
              {subtitle}
            </p>
            <div className="mt-7">{children}</div>

            {footer && (
              <>
                <div className="my-6 flex items-center gap-4 text-xs font-medium text-stone-400 dark:text-slate-500">
                  <span className="h-px flex-1 bg-stone-200 dark:bg-white/15" />
                  OR
                  <span className="h-px flex-1 bg-stone-200 dark:bg-white/15" />
                </div>
                <p className="text-center text-sm text-stone-500 dark:text-slate-400">
                  {footer}
                </p>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
