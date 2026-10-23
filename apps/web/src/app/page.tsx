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
    cta: "Upgrade to Pro",
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
    cta: "Upgrade to Business",
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
      className={`absolute flex items-center gap-3 rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-xl shadow-blue-900/10 backdrop-blur ${className}`}
    >
      <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-brand">
        {icon}
      </span>
      <div>
        <p className="text-[11px] font-medium text-stone-500">{label}</p>
        <p className="text-sm font-extrabold text-brand-black">{value}</p>
        {tag && (
          <span className="mt-0.5 inline-block rounded bg-green-50 px-1.5 text-[10px] font-semibold text-green-600">
            {tag}
          </span>
        )}
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-white">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-stone-100/80 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-4">
          <BrandLogo brand={brand} priority />
          <nav className="hidden items-center gap-8 text-sm font-medium text-stone-600 md:flex">
            {[
              ["#product", "Product"],
              ["#how", "How it works"],
              ["#demo", "Sample BOQ"],
              ["#pricing", "Pricing"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="relative transition-colors hover:text-brand after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-0 after:bg-brand after:transition-all hover:after:w-full"
              >
                {label}
              </a>
            ))}
          </nav>
          <Link
            href="/demo"
            className="group inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition hover:-translate-y-0.5 hover:bg-brand-dark"
          >
            Open the live demo
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-stone-600 hover:text-brand"
          >
            Log in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-blueprint relative overflow-hidden bg-gradient-to-b from-blue-50/70 via-white to-white">
        <div className="pointer-events-none absolute -left-24 top-10 size-80 animate-blob rounded-full bg-blue-300/30 blur-3xl" />
        <div
          className="pointer-events-none absolute right-0 top-32 size-96 animate-blob rounded-full bg-sky-300/30 blur-3xl"
          style={{ animationDelay: "-6s" }}
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
          <div>
            <span
              className="inline-block animate-fade-up rounded-full bg-blue-100/80 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand"
              style={fadeUp(0)}
            >
              Construction cost estimator &amp; 3D visualizer
            </span>
            <h1
              className="mt-5 animate-fade-up text-5xl font-extrabold leading-[1.05] tracking-tight text-brand-black sm:text-6xl"
              style={fadeUp(120)}
            >
              From floor plan to{" "}
              <span className="text-shimmer animate-shimmer">final quote.</span>
            </h1>
            <p
              className="mt-5 max-w-lg animate-fade-up text-lg leading-relaxed text-stone-600"
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
                className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-6 py-3.5 text-sm font-semibold text-brand-black shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
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
                className="aspect-[5/4] w-full rounded-3xl border border-white object-cover shadow-2xl shadow-blue-900/20"
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
              value="Rs 6,640,000"
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
            <p className="text-xs font-bold uppercase tracking-wide text-brand">
              Why {brand.name}
            </p>
            <h2 className="mt-3 text-4xl font-extrabold leading-tight text-brand-black">
              Designed for speed, accuracy and confidence.
            </h2>
            <p className="mt-4 text-stone-500">
              Everything you need to go from a house plan to a detailed BOQ and
              3D model, all in one place.
            </p>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }, i) => (
              <Reveal key={title} delay={i * 120}>
                <div className="group h-full rounded-2xl border border-stone-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-2 hover:border-brand/30 hover:shadow-xl hover:shadow-blue-900/10">
                  <span className="grid size-12 place-items-center rounded-xl bg-brand text-white shadow-lg shadow-brand/30 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-5 font-bold text-brand-black">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone-500">
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
        className="scroll-mt-20 bg-gradient-to-b from-blue-50/60 to-white py-20"
      >
        <div className="mx-auto max-w-6xl px-4">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-wide text-brand">
              Simple process
            </p>
            <h2 className="mt-3 text-4xl font-extrabold text-brand-black">
              How it works
            </h2>
            <p className="mt-3 max-w-md text-stone-500">
              From an enquiry to a complete, client-ready package, in just a few
              steps.
            </p>
          </Reveal>

          <div className="relative mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="absolute left-0 right-0 top-[22px] hidden h-px border-t-2 border-dashed border-brand/25 lg:block" />
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <Reveal key={title} delay={i * 140}>
                <div className="relative">
                  <div className="flex items-center gap-3">
                    <span className="relative z-10 grid size-11 place-items-center rounded-full bg-brand text-sm font-bold text-white shadow-lg shadow-brand/30 ring-4 ring-white">
                      {i + 1}
                    </span>
                    <span className="grid size-11 place-items-center rounded-xl border border-stone-200 bg-white text-brand shadow-sm">
                      <Icon className="size-5" />
                    </span>
                  </div>
                  <h3 className="mt-5 font-bold text-brand-black">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone-500">
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
            <div className="bg-blueprint relative rounded-3xl bg-blue-50/60 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/demo.jpg"
                alt="House plan and 3D preview"
                className="aspect-[4/3] w-full rounded-2xl object-cover shadow-xl"
              />
              <div className="absolute -bottom-6 left-4 w-60 animate-float rounded-2xl border border-stone-100 bg-white p-4 shadow-2xl shadow-blue-900/15 sm:-left-6">
                <p className="text-xs font-bold text-brand-black">
                  Project summary
                </p>
                <dl className="mt-2 space-y-1 text-xs text-stone-500">
                  <div className="flex justify-between">
                    <dt>Total area</dt>
                    <dd className="font-semibold text-brand-black">
                      <CountUp to={1250} /> sq ft
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Sample cost</dt>
                    <dd className="font-semibold text-brand-black">
                      <CountUp to={750850} prefix="Rs " />
                    </dd>
                  </div>
                </dl>
                <Link
                  href="/office"
                  className="mt-3 inline-flex items-center gap-1 rounded-lg border border-brand/30 px-3 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand hover:text-white"
                >
                  View 3D model <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>
          </Reveal>

          <Reveal delay={150}>
            <p className="text-xs font-bold uppercase tracking-wide text-brand">
              Sample BOQ
            </p>
            <h2 className="mt-3 text-4xl font-extrabold text-brand-black">
              See a sample BOQ
            </h2>
            <p className="mt-2 text-stone-500">
              Sample figures for illustration only. A clear breakdown, line by
              line.
            </p>
            <div className="mt-6 overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="bg-stone-50 text-xs font-semibold text-stone-500">
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
                      className="border-t border-stone-100 transition-colors hover:bg-blue-50/50"
                    >
                      <td className="px-5 py-3 text-stone-700">{item}</td>
                      <td className="px-5 py-3 text-right text-stone-700">
                        {qty}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-stone-800">
                        {amount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Link
              href="/office"
              className="group mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brand-dark"
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
        className="scroll-mt-20 bg-gradient-to-b from-white to-blue-50/60 py-20"
      >
        <div className="mx-auto max-w-6xl px-4">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-wide text-brand">
              Simple pricing
            </p>
            <h2 className="mt-3 text-4xl font-extrabold text-brand-black">
              Choose the plan that fits your needs
            </h2>
            <p className="mt-2 text-stone-500">
              Start free. Upgrade as you grow. Example plans, final pricing may
              change.
            </p>
          </Reveal>
          <div className="mt-12 grid items-center gap-6 md:grid-cols-3">
            {PLANS.map((p, i) => (
              <Reveal key={p.name} delay={i * 120}>
                <div
                  className={`relative rounded-2xl border bg-white p-7 transition duration-300 hover:-translate-y-2 ${
                    p.featured
                      ? "border-brand shadow-2xl shadow-brand/20 ring-1 ring-brand md:scale-105"
                      : "border-stone-200 shadow-sm hover:shadow-xl"
                  }`}
                >
                  {p.featured && (
                    <span className="absolute -top-3 right-5 rounded-full bg-brand px-3 py-1 text-[11px] font-bold text-white shadow-md">
                      Most popular
                    </span>
                  )}
                  <h3 className="font-bold text-brand-black">{p.name}</h3>
                  <p className="mt-3 text-4xl font-extrabold text-brand-black">
                    {p.price}
                  </p>
                  <p className="text-xs text-stone-400">{p.note}</p>
                  <ul className="mt-6 space-y-2.5 text-sm text-stone-600">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={p.href}
                    className={`mt-7 block rounded-xl px-4 py-3 text-center text-sm font-semibold transition ${
                      p.featured
                        ? "bg-brand text-white shadow-lg shadow-brand/30 hover:bg-brand-dark"
                        : "border border-brand/40 text-brand hover:bg-brand hover:text-white"
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
      <section className="relative overflow-hidden bg-brand-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/demo.jpg"
          alt=""
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 hidden h-full w-1/2 object-cover opacity-40 [mask-image:linear-gradient(to_right,transparent,black_60%)] md:block"
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
              final CTA
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#0b1220] text-stone-400">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-xs">
          <span className="rounded-md bg-white p-1.5">
            <BrandLogo brand={brand} className="h-7 w-auto" />
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
