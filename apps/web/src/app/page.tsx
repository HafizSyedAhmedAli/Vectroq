// apps/web/src/app/page.tsx
"use client";

import { BrandLogo } from "@/components/BrandLogo";
import { IntakeForm, type IntakeSubmitResult } from "@/components/IntakeForm";
import { SiteFooter } from "@/components/SiteFooter";
import { brand } from "@/lib/brand";
import { buildLeadRequest } from "@/lib/build-lead-request";
import type { LeadIntakeInput } from "@tmcc/lead-intake";
import { MapPin, Phone, ShieldCheck } from "lucide-react";

export default function HomePage() {
  async function handleSubmit(
    data: LeadIntakeInput,
    planFile: File | null,
  ): Promise<IntakeSubmitResult> {
    const res = await fetch("/api/leads", buildLeadRequest(data, planFile));
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      const messages = body?.errors
        ? Object.values(body.errors as Record<string, string>).join(" ")
        : "";
      throw new Error(messages || "Failed to submit lead");
    }

    return { estimate: body.estimate };
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="relative z-10 bg-white/90 backdrop-blur border-b border-stone-100">
        <div className="max-w-6xl mx-auto px-4 h-[72px] flex items-center justify-between">
          <BrandLogo priority />
          {brand.contact.phone && (
            <a
              href={`tel:${brand.contact.phone.replace(/\s/g, "")}`}
              className="flex items-center gap-2 text-sm font-semibold text-brand-black"
            >
              <Phone className="size-4 text-brand" />
              {brand.contact.phone}
            </a>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-stone-50 to-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/demo.jpg"
          alt=""
          aria-hidden
          className="hidden lg:block absolute right-0 top-0 h-[420px] w-[45%] object-cover opacity-90 [mask-image:linear-gradient(to_right,transparent,black_45%)]"
        />
        <div className="relative max-w-6xl mx-auto px-4 pt-10 pb-8">
          <div className="flex items-center gap-3 text-xs font-semibold tracking-wide uppercase mb-4">
            <span className="h-0.5 w-8 bg-brand" />
            <span className="text-brand-black">
              House Construction <span className="text-brand">Division</span>
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-brand-black tracking-tight">
            Let&apos;s Build Your <span className="text-brand">Home</span>
          </h1>
          <p className="mt-4 max-w-md text-stone-500">
            Tell us about your project and our team will contact you to discuss
            the next steps.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-stone-600">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-4" /> Free, no obligation
            </span>
            <span className="h-4 w-px bg-stone-300" />
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4" /> Cities across Pakistan
            </span>
          </div>
        </div>
      </section>

      {/* Form + summary */}
      <main className="flex-1 -mt-2 pb-16">
        <div className="max-w-6xl mx-auto px-4">
          <IntakeForm onSubmit={handleSubmit} />
        </div>
      </main>

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}
