// apps/web/src/app/page.tsx
import Link from "next/link";
import {
  ArrowRight,
  Box,
  Calculator,
  Check,
  FileText,
  FileUp,
  Ruler,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { SiteFooter } from "@/components/SiteFooter";
import { brand } from "@/lib/brand";

const PROBLEMS = [
  {
    icon: Wallet,
    title: "Quotes take days",
    text: "Contractors measure plans by hand and re-key numbers into spreadsheets, so every quote is slow and easy to get wrong.",
  },
  {
    icon: ShieldCheck,
    title: "Prices are opaque",
    text: "Homeowners get a single lump sum with no way to see what they are paying for or compare offers.",
  },
  {
    icon: Users,
    title: "Small firms lack tools",
    text: "Estimating software is built for large companies. Most local contractors still work from paper and memory.",
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
    icon: Box,
    title: "Share it with the client",
    text: "Send a 3D view, cost summary and PDF on a single page.",
  },
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
    cta: "Try the demo",
    href: "/office",
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
    cta: "Join the waitlist",
    href: "/request",
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

const SAMPLE = [
  ["Brick masonry (labour)", "2,150 sq ft", "107,500"],
  ["Plaster, both faces (labour)", "4,300 sq ft", "129,000"],
  ["Tile flooring (supply & fixing)", "1,200 sq ft", "60,000"],
  ["Cement (50 kg bags)", "310 bags", "454,150"],
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-20 border-b border-stone-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-4">
          <BrandLogo priority />
          <nav className="hidden items-center gap-6 text-sm font-medium text-stone-600 md:flex">
            <a href="#problem" className="hover:text-brand">
              Problem
            </a>
            <a href="#how" className="hover:text-brand">
              How it works
            </a>
            <a href="#demo" className="hover:text-brand">
              Demo
            </a>
            <a href="#pricing" className="hover:text-brand">
              Pricing
            </a>
          </nav>
          <Link
            href="/office"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Try the demo
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-stone-50 to-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-brand">
              Cost estimating for contractors
            </p>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-brand-black sm:text-5xl">
              {brand.tagline}
            </h1>
            <p className="mt-4 max-w-lg text-lg text-stone-600">
              {brand.name} turns a floor plan into a priced Bill of Quantities
              and a 3D view in minutes, so contractors can quote faster and
              clients can see exactly what they are paying for.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/office"
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand-dark"
              >
                Try the demo <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/request"
                className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-6 py-3 text-sm font-semibold text-brand-black hover:bg-stone-50"
              >
                Request a quote
              </Link>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/demo.jpg"
            alt="A house plan with a priced cost breakdown"
            className="w-full rounded-2xl border border-stone-200 shadow-lg"
          />
        </div>
      </section>

      {/* Problem */}
      <section
        id="problem"
        className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16"
      >
        <h2 className="text-3xl font-extrabold text-brand-black">
          Estimating is still done by hand
        </h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {PROBLEMS.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-brand">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-4 font-bold text-brand-black">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-500">
                {text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 bg-stone-50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-3xl font-extrabold text-brand-black">
            How it works
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <div
                key={title}
                className="rounded-2xl border border-stone-200 bg-white p-6"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-8 place-items-center rounded-full bg-brand text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <Icon className="size-5 text-brand-black" />
                </div>
                <h3 className="mt-4 font-bold text-brand-black">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-500">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo */}
      <section id="demo" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <h2 className="text-3xl font-extrabold text-brand-black">
          See a sample BOQ
        </h2>
        <p className="mt-2 text-stone-500">
          Sample figures for illustration only.
        </p>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-stone-50 text-xs font-semibold text-stone-500">
              <tr>
                <th className="px-5 py-3 text-left">Item</th>
                <th className="px-5 py-3 text-right">Quantity</th>
                <th className="px-5 py-3 text-right">Amount (Rs)</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE.map(([item, qty, amount]) => (
                <tr key={item} className="border-t border-stone-100">
                  <td className="px-5 py-3 text-stone-700">{item}</td>
                  <td className="px-5 py-3 text-right text-stone-700">{qty}</td>
                  <td className="px-5 py-3 text-right text-stone-700">
                    {amount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Link
          href="/office"
          className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brand-dark"
        >
          <FileText className="size-4" /> Open the live demo{" "}
          <ArrowRight className="size-4" />
        </Link>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 bg-stone-50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-3xl font-extrabold text-brand-black">
            Simple pricing
          </h2>
          <p className="mt-2 text-stone-500">
            Example plans. Final pricing may change.
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`rounded-2xl border bg-white p-6 shadow-sm ${
                  p.featured
                    ? "border-brand ring-1 ring-brand"
                    : "border-stone-200"
                }`}
              >
                <h3 className="font-bold text-brand-black">{p.name}</h3>
                <p className="mt-3 text-3xl font-extrabold text-brand-black">
                  {p.price}
                </p>
                <p className="text-xs text-stone-400">{p.note}</p>
                <ul className="mt-5 space-y-2 text-sm text-stone-600">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={p.href}
                  className={`mt-6 block rounded-xl px-4 py-2.5 text-center text-sm font-semibold ${
                    p.featured
                      ? "bg-brand text-white hover:bg-brand-dark"
                      : "border border-stone-300 text-brand-black hover:bg-stone-50"
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h2 className="text-3xl font-extrabold text-brand-black">
          Quote your next project in minutes
        </h2>
        <Link
          href="/office"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          Try the demo <ArrowRight className="size-4" />
        </Link>
      </section>

      <SiteFooter />
    </div>
  );
}
