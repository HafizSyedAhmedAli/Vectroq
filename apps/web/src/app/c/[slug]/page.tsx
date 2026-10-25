import type { Metadata } from "next";
import { ThemeToggle } from "@/components/ThemeToggle";
import { notFound } from "next/navigation";
import { MapPin, Phone, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { BuildAnimation } from "@/components/BuildAnimation";
import { SiteFooter } from "@/components/SiteFooter";
import { PublicIntake } from "@/components/intake/PublicIntake";
import { brandFromOrg, brandStyle } from "@/lib/brand";
import { getOrgBySlug } from "@/lib/org";
import { resolveOrgRules } from "@vectroq/shared-types";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const org = await getOrgBySlug((await params).slug);
  return { title: org ? `Request a quote · ${org.name}` : "Not found" };
}

function Chip({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-2.5 text-sm text-stone-700">
      <span className="grid size-9 place-items-center rounded-full bg-brand/10 text-brand [&_svg]:size-4">
        {icon}
      </span>
      {children}
    </span>
  );
}

export default async function OrgIntakePage({ params }: Props) {
  const org = await getOrgBySlug((await params).slug);
  if (!org) notFound();
  const brand = brandFromOrg(org);
  const rules = resolveOrgRules(org.rules);

  return (
    <div
      style={brandStyle(brand)}
      className="vq-app flex min-h-screen flex-col bg-white"
    >
      <header className="relative z-20 border-b border-stone-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-4">
          <BrandLogo brand={brand} />
          <div className="flex items-center gap-4">
            {brand.contact.phone && (
              <a
                href={`tel:${brand.contact.phone.replace(/\s/g, "")}`}
                className="flex items-center gap-2 text-sm font-semibold text-brand-black"
              >
                <Phone className="size-4 text-brand" />
                {brand.contact.phone}
              </a>
            )}
            <ThemeToggle className="vq-keep-light" />
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-b from-brand/10 to-white">
        <div className="bg-blueprint pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-6 px-4 pb-6 pt-4 lg:grid-cols-[1fr_1.15fr] lg:pb-10">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-black">
              <span className="size-2 rounded-full bg-brand" />
              Project request
            </span>
            <h1 className="mt-5 text-5xl font-extrabold tracking-tight text-brand-black sm:text-6xl">
              Request a <span className="text-brand">Quote</span>
            </h1>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-stone-600">
              Tell {brand.name} about your project and we&apos;ll get back to
              you with the next steps.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Chip icon={<ShieldCheck />}>Free, no obligation</Chip>
              <span className="hidden h-6 w-px bg-stone-300 sm:block" />
              <Chip icon={<MapPin />}>Cities across Pakistan</Chip>
            </div>
          </div>

          <BuildAnimation className="mx-auto w-full mb-8 max-w-[640px]" />
        </div>
      </section>

      <main className="relative z-10 flex-1 pb-16 lg:-mt-14">
        <div className="mx-auto max-w-6xl px-4">
          <PublicIntake
            orgSlug={org.slug}
            models={rules.models}
            categories={rules.categories}
          />
        </div>
      </main>

      <SiteFooter brand={brand} />
    </div>
  );
}
