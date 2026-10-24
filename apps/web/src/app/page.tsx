// apps/web/src/app/page.tsx
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Box,
  Calculator,
  Check,
  Clock,
  FileText,
  FileUp,
  Layers,
  Receipt,
  Ruler,
  Share2,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CountUp } from "@/components/landing/CountUp";
import { Reveal } from "@/components/landing/Reveal";
import { platformBrand as brand } from "@/lib/brand";

const FEATURES = [
  {
    icon: Clock,
    title: "Quotations in minutes",
    text: "Get a priced estimate as soon as the drawing is uploaded, not days later.",
  },
  {
    icon: Layers,
    title: "Accurate BOQs",
    text: "Rooms, walls, doors and windows are detected and priced from your approved rates.",
  },
  {
    icon: Box,
    title: "3D visualization",
    text: "Explore the project in an interactive 3D model built from the drawing.",
  },
];

const STEPS = [
  {
    icon: FileUp,
    title: "Upload a plan",
    text: "Drop in a DXF drawing. Units are detected automatically.",
  },
  {
    icon: Ruler,
    title: "Review what we read",
    text: "Check rooms, walls, doors and windows, and correct anything in one table.",
  },
  {
    icon: Calculator,
    title: "Get a priced BOQ",
    text: "Quantities are priced from your approved rate schedule, with tax and totals.",
  },
  {
    icon: Share2,
    title: "Share with your client",
    text: "Send a 3D view, cost summary and PDF on a single client page.",
  },
];

const SAMPLE = [
  ["Brick masonry (labour)", "2,150 sq ft", "107,500"],
  ["Plaster, both faces (labour)", "4,300 sq ft", "129,000"],
  ["Tile flooring (supply & fixing)", "1,200 sq ft", "60,000"],
  ["Cement (50 kg bags)", "310 bags", "454,150"],
];

// Example plans, not final pricing.
const PLANS = [
  {
    name: "Starter",
    price: "Free",
    note: "For trying it out",
    features: [
      "3 projects per month",
      "PDF with Vectroq branding",
      "1 team member",
    ],
    cta: "Start free",
    href: "/signup",
    featured: false,
  },
  {
    name: "Pro",
    price: "Rs 4,999",
    note: "per month",
    features: [
      "Unlimited projects",
      "Your logo on the BOQ and PDF",
      "Custom rate schedules",
      "5 team members",
    ],
    cta: "Get Pro",
    href: "/signup",
    featured: true,
  },
  {
    name: "Business",
    price: "Rs 14,999",
    note: "per month",
    features: [
      "Everything in Pro",
      "Custom tax and labour rules",
      "Unlimited team members",
      "Priority support",
    ],
    cta: "Talk to us",
    href: "/request",
    featured: false,
  },
];

const fadeUp = (delay: number) => ({ animationDelay: `${delay}ms` });

// The logo is dark artwork; on the dark theme it is turned into a white mark.
const logoCls = "h-11 w-auto dark:brightness-0 dark:invert";

function FloatingCard({
  className,
  icon,
  label,
  value,
  tag,
}: {
  className: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  tag?: string;
}) {
  return (
    <div
      className={`absolute flex items-center gap-3 rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-xl shadow-blue-900/10 backdrop-blur dark:hidden ${className}`}
    >
      <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-brand dark:bg-blue-500/15 dark:text-blue-300">
        {icon}
      </span>
      <div>
        <p className="text-[11px] font-medium text-stone-500 dark:text-slate-400">
          {label}
        </p>
        <p className="text-sm font-extrabold text-brand-black dark:text-white">
          {value}
        </p>
        {tag && (
          <span className="mt-0.5 inline-block rounded bg-green-50 px-1.5 text-[10px] font-semibold text-green-600 dark:bg-green-500/10 dark:text-green-400">
            {tag}
          </span>
        )}
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-white dark:bg-[#050b1a]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-stone-100/80 bg-white/80 backdrop-blur-lg dark:border-white/10 dark:bg-[#050b1a]/80">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-3 px-4">
          <BrandLogo brand={brand} className={logoCls} priority />
          <nav className="hidden items-center gap-8 text-sm font-medium text-stone-600 md:flex dark:text-slate-300">
            {[
              ["#product", "Product"],
              ["#how", "How it works"],
              ["#demo", "Sample BOQ"],
              ["#pricing", "Pricing"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="relative transition-colors hover:text-brand dark:hover:text-white after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-0 after:bg-brand after:transition-all hover:after:w-full"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/demo"
              className="group inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition hover:-translate-y-0.5 hover:bg-brand-dark"
            >
              Open the live demo
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-stone-600 hover:text-brand dark:text-slate-300 dark:hover:text-white"
            >
              Log in
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-blueprint relative overflow-hidden bg-gradient-to-b from-blue-50/70 via-white to-white dark:from-[#0a1633] dark:via-[#050b1a] dark:to-[#050b1a]">
        <div className="pointer-events-none absolute -left-24 top-10 size-80 animate-blob rounded-full bg-blue-300/30 blur-3xl dark:bg-blue-600/20" />
        <div
          className="pointer-events-none absolute right-0 top-32 size-96 animate-blob rounded-full bg-sky-300/30 blur-3xl dark:bg-sky-500/15"
          style={{ animationDelay: "-6s" }}
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
          <div>
            <span
              className="inline-block animate-fade-up rounded-full bg-blue-100/80 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand dark:bg-blue-500/10 dark:text-blue-300 dark:ring-1 dark:ring-blue-400/20"
              style={fadeUp(0)}
            >
              Construction cost estimator &amp; 3D visualizer
            </span>
            <h1
              className="mt-5 animate-fade-up text-5xl font-extrabold leading-[1.05] tracking-tight text-brand-black sm:text-6xl dark:text-white"
              style={fadeUp(120)}
            >
              From floor plan to{" "}
              <span className="text-shimmer animate-shimmer">final quote.</span>
            </h1>
            <p
              className="mt-5 max-w-lg animate-fade-up text-lg leading-relaxed text-stone-600 dark:text-slate-300"
              style={fadeUp(240)}
            >
              Upload your house plan (DXF) and turn it into a priced Bill of
              Quantities and a 3D model, in minutes, not days. Faster estimates,
              better decisions, more winning bids.
            </p>
            <div
              className="mt-8 flex animate-fade-up flex-wrap gap-3"
              style={fadeUp(360)}
            >
              <Link
                href="/demo"
                className="group inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-brand/30 transition hover:-translate-y-0.5 hover:bg-brand-dark"
              >
                View 3D model
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/request"
                className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-6 py-3.5 text-sm font-semibold text-brand-black shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md dark:border-white/15 dark:bg-transparent dark:text-white dark:hover:border-white/40"
              >
                Request a quote
              </Link>
            </div>
          </div>

          {/* Hero visual */}
          <div
            className="relative mx-auto w-full max-w-xl animate-fade-up"
            style={fadeUp(300)}
          >
            <div className="animate-float-slow">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/demo.jpg"
                alt="A house plan with a priced cost breakdown"
                className="aspect-[5/4] w-full rounded-3xl border border-white object-cover shadow-2xl shadow-blue-900/20 dark:hidden"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/demo-dark.jpg"
                alt="A 3D house on its blueprint with a priced cost breakdown"
                className="hidden w-full rounded-3xl object-cover shadow-2xl shadow-blue-500/20 dark:block"
              />
            </div>
            <FloatingCard
              className="-left-4 top-6 animate-float sm:-left-8"
              icon={<Box className="size-5" />}
              label="3D Model"
              value="Interactive view"
            />
            <FloatingCard
              className="-right-2 -top-4 animate-float-slow sm:-right-6"
              icon={<FileText className="size-5" />}
              label="BOQ"
              value="Rs 66.4 lakh"
              tag="Sample estimate"
            />
            <FloatingCard
              className="-bottom-5 right-6 animate-float sm:right-10"
              icon={<Receipt className="size-5" />}
              label="Project cost"
              value="Rs 6,440,000"
            />
          </div>
        </div>
      </section>

      {/* Why */}
      <section
        id="product"
        className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20"
      >
        <div className="grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-wide text-brand dark:text-blue-400">
              Why {brand.name}
            </p>
            <h2 className="mt-3 text-4xl font-extrabold leading-tight text-brand-black dark:text-white">
              Designed for speed, accuracy and confidence.
            </h2>
            <p className="mt-4 text-stone-500 dark:text-slate-400">
              Everything you need to go from a house plan to a detailed BOQ and
              3D model, all in one place.
            </p>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }, i) => (
              <Reveal key={title} delay={i * 120}>
                <div className="group h-full rounded-2xl border border-stone-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-2 hover:border-brand/30 hover:shadow-xl hover:shadow-blue-900/10 dark:border-white/10 dark:bg-white/5 dark:hover:border-blue-400/40 dark:hover:shadow-blue-500/10">
                  <span className="grid size-12 place-items-center rounded-xl bg-brand text-white shadow-lg shadow-brand/30 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-5 font-bold text-brand-black dark:text-white">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone-500 dark:text-slate-400">
                    {text}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how"
        className="scroll-mt-20 bg-gradient-to-b from-blue-50/60 to-white py-20 dark:from-[#07102a] dark:to-[#050b1a]"
      >
        <div className="mx-auto max-w-6xl px-4">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-wide text-brand dark:text-blue-400">
              Simple process
            </p>
            <h2 className="mt-3 text-4xl font-extrabold text-brand-black dark:text-white">
              How it works
            </h2>
            <p className="mt-3 max-w-md text-stone-500 dark:text-slate-400">
              From an enquiry to a complete, client-ready package, in just a few
              steps.
            </p>
          </Reveal>

          <div className="relative mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="absolute left-0 right-0 top-[22px] hidden h-px border-t-2 border-dashed border-brand/25 lg:block dark:border-blue-400/25" />
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <Reveal key={title} delay={i * 140}>
                <div className="relative">
                  <div className="flex items-center gap-3">
                    <span className="relative z-10 grid size-11 place-items-center rounded-full bg-brand text-sm font-bold text-white shadow-lg shadow-brand/30 ring-4 ring-white dark:ring-[#07102a]">
                      {i + 1}
                    </span>
                    <span className="grid size-11 place-items-center rounded-xl border border-stone-200 bg-white text-brand shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-blue-300">
                      <Icon className="size-5" />
                    </span>
                  </div>
                  <h3 className="mt-5 font-bold text-brand-black dark:text-white">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone-500 dark:text-slate-400">
                    {text}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Sample BOQ */}
      <section
        id="demo"
        className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20"
      >
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <div className="bg-blueprint relative rounded-3xl bg-blue-50/60 p-4 dark:bg-white/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/demo.jpg"
                alt="House plan and 3D preview"
                className="aspect-[4/3] w-full rounded-2xl object-cover shadow-xl dark:hidden"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/demo-dark.jpg"
                alt="3D house on its blueprint"
                className="hidden aspect-[4/3] w-full rounded-2xl object-cover shadow-xl dark:block"
              />
              <div className="absolute -bottom-6 left-4 w-60 animate-float rounded-2xl border border-stone-100 bg-white p-4 shadow-2xl shadow-blue-900/15 sm:-left-6 dark:border-white/10 dark:bg-[#0b1630] dark:shadow-blue-500/10">
                <p className="text-xs font-bold text-brand-black dark:text-white">
                  Project summary
                </p>
                <dl className="mt-2 space-y-1 text-xs text-stone-500 dark:text-slate-400">
                  <div className="flex justify-between">
                    <dt>Total area</dt>
                    <dd className="font-semibold text-brand-black dark:text-white">
                      <CountUp to={1250} /> sq ft
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Sample cost</dt>
                    <dd className="font-semibold text-brand-black dark:text-white">
                      <CountUp to={750850} prefix="Rs " />
                    </dd>
                  </div>
                </dl>
                <Link
                  href="/demo"
                  className="mt-3 inline-flex items-center gap-1 rounded-lg border border-brand/30 px-3 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand hover:text-white dark:border-blue-400/40 dark:text-blue-300"
                >
                  View 3D model <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>
          </Reveal>

          <Reveal delay={150}>
            <p className="text-xs font-bold uppercase tracking-wide text-brand dark:text-blue-400">
              Sample BOQ
            </p>
            <h2 className="mt-3 text-4xl font-extrabold text-brand-black dark:text-white">
              See a sample BOQ
            </h2>
            <p className="mt-2 text-stone-500 dark:text-slate-400">
              Sample figures for illustration only. A clear breakdown, line by
              line.
            </p>
            <div className="mt-6 overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="bg-stone-50 text-xs font-semibold text-stone-500 dark:bg-white/5 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 text-left">Item</th>
                    <th className="px-5 py-3 text-right">Quantity</th>
                    <th className="px-5 py-3 text-right">Amount (Rs)</th>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE.map(([item, qty, amount]) => (
                    <tr
                      key={item}
                      className="border-t border-stone-100 transition-colors hover:bg-blue-50/50 dark:border-white/10 dark:hover:bg-white/5"
                    >
                      <td className="px-5 py-3 text-stone-700 dark:text-slate-200">
                        {item}
                      </td>
                      <td className="px-5 py-3 text-right text-stone-700 dark:text-slate-200">
                        {qty}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-stone-800 dark:text-white">
                        {amount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Link
              href="/demo"
              className="group mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brand-dark dark:text-blue-400 dark:hover:text-blue-300"
            >
              <FileText className="size-4" /> Open the live demo
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Pricing */}
      <section
        id="pricing"
        className="scroll-mt-20 bg-gradient-to-b from-white to-blue-50/60 py-20 dark:from-[#050b1a] dark:to-[#07102a]"
      >
        <div className="mx-auto max-w-6xl px-4">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-wide text-brand dark:text-blue-400">
              Simple pricing
            </p>
            <h2 className="mt-3 text-4xl font-extrabold text-brand-black dark:text-white">
              Choose the plan that fits your needs
            </h2>
            <p className="mt-2 text-stone-500 dark:text-slate-400">
              Start free. Upgrade as you grow. Example plans, final pricing may
              change.
            </p>
          </Reveal>
          <div className="mt-12 grid items-center gap-6 md:grid-cols-3">
            {PLANS.map((p, i) => (
              <Reveal key={p.name} delay={i * 120}>
                <div
                  className={`relative rounded-2xl border bg-white p-7 transition duration-300 hover:-translate-y-2 dark:bg-white/5 ${
                    p.featured
                      ? "border-brand shadow-2xl shadow-brand/20 ring-1 ring-brand md:scale-105 dark:bg-blue-500/10 dark:shadow-blue-500/20"
                      : "border-stone-200 shadow-sm hover:shadow-xl dark:border-white/10"
                  }`}
                >
                  {p.featured && (
                    <span className="absolute -top-3 right-5 rounded-full bg-brand px-3 py-1 text-[11px] font-bold text-white shadow-md">
                      Most popular
                    </span>
                  )}
                  <h3 className="font-bold text-brand-black dark:text-white">
                    {p.name}
                  </h3>
                  <p className="mt-3 text-4xl font-extrabold text-brand-black dark:text-white">
                    {p.price}
                  </p>
                  <p className="text-xs text-stone-400 dark:text-slate-400">
                    {p.note}
                  </p>
                  <ul className="mt-6 space-y-2.5 text-sm text-stone-600 dark:text-slate-300">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-brand dark:text-blue-400" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={p.href}
                    className={`mt-7 block rounded-xl px-4 py-3 text-center text-sm font-semibold transition ${
                      p.featured
                        ? "bg-brand text-white shadow-lg shadow-brand/30 hover:bg-brand-dark"
                        : "border border-brand/40 text-brand hover:bg-brand hover:text-white dark:border-blue-400/40 dark:text-blue-300 dark:hover:text-white"
                    }`}
                  >
                    {p.cta}
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden bg-brand-black dark:bg-[#060d20]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/demo.jpg"
          alt=""
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 hidden h-full w-1/2 object-cover opacity-40 [mask-image:linear-gradient(to_right,transparent,black_60%)] md:block dark:md:hidden"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/demo-dark.jpg"
          alt=""
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 hidden h-full w-1/2 object-cover opacity-70 [mask-image:linear-gradient(to_right,transparent,black_60%)] dark:md:block"
        />
        <div className="pointer-events-none absolute -left-20 top-0 size-72 animate-blob rounded-full bg-brand/30 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-20">
          <Reveal>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-sky-300">
              <BadgeCheck className="size-4" /> Get started
            </p>
            <h2 className="mt-3 max-w-md text-4xl font-extrabold leading-tight text-white">
              Quote your next project in minutes
            </h2>
            <p className="mt-3 max-w-md text-stone-300">
              Upload your plans. Get a priced BOQ and 3D model. Faster, easier,
              smarter.
            </p>
            <Link
              href="/demo"
              className="group mt-7 inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-brand/40 transition hover:-translate-y-0.5 hover:bg-brand-dark"
            >
              Start now
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#0b1220] text-stone-400 dark:bg-[#050b1a]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-xs">
          <span className="rounded-md bg-white p-1.5 dark:bg-transparent">
            <BrandLogo
              brand={brand}
              className="h-7 w-auto dark:brightness-0 dark:invert"
            />
          </span>
          <nav className="flex gap-6">
            <a href="#product" className="hover:text-white">
              Product
            </a>
            <a href="#how" className="hover:text-white">
              How it works
            </a>
            <a href="#demo" className="hover:text-white">
              Sample BOQ
            </a>
            <a href="#pricing" className="hover:text-white">
              Pricing
            </a>
          </nav>
          <span>{brand.tagline}</span>
        </div>
      </footer>
    </div>
  );
}
