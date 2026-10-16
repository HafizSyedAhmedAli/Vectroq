import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin, Phone, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { SiteFooter } from "@/components/SiteFooter";
import { PublicIntake } from "@/components/intake/PublicIntake";
import { brandFromOrg, brandStyle } from "@/lib/brand";
import { getOrgBySlug } from "@/lib/org";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const org = await getOrgBySlug((await params).slug);
  return { title: org ? `Request a quote · ${org.name}` : "Not found" };
}

export default async function OrgIntakePage({ params }: Props) {
  const org = await getOrgBySlug((await params).slug);
  if (!org) notFound();
  const brand = brandFromOrg(org);

  return (
    <div
      style={brandStyle(brand)}
      className="min-h-screen flex flex-col bg-white"
    >
      <header className="relative z-10 bg-white/90 backdrop-blur border-b border-stone-100">
        <div className="max-w-6xl mx-auto px-4 h-[72px] flex items-center justify-between">
          <BrandLogo brand={brand} />
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

      <section className="relative overflow-hidden bg-gradient-to-b from-stone-50 to-white">
        <div className="relative max-w-6xl mx-auto px-4 pt-10 pb-8">
          <div className="flex items-center gap-3 text-xs font-semibold tracking-wide uppercase mb-4">
            <span className="h-0.5 w-8 bg-brand" />
            <span className="text-brand-black">
              Project <span className="text-brand">Request</span>
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-brand-black tracking-tight">
            Request a <span className="text-brand">Quote</span>
          </h1>
          <p className="mt-4 max-w-md text-stone-500">
            Tell {brand.name} about your project and we&apos;ll get back to you
            with the next steps.
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

      <main className="flex-1 -mt-2 pb-16">
        <div className="max-w-6xl mx-auto px-4">
          <PublicIntake orgSlug={org.slug} />
        </div>
      </main>

      <SiteFooter brand={brand} />
    </div>
  );
}
