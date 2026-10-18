import { Building2 } from "lucide-react";
import { EmbedCode } from "@/components/EmbedCode";
import { OrgSettingsForm } from "@/components/OrgSettingsForm";
import { brandFromOrg } from "@/lib/brand";
import { requirePage } from "@/lib/org";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { org } = await requirePage("OWNER");
  const brand = brandFromOrg(org);

  return (
    <main className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-blue-50/40 to-white pb-16">
      <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
        <div className="flex items-start gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-blue-50 text-brand">
            <Building2 className="size-7" />
          </span>
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-brand-black">
              Company settings
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-stone-500">
              Manage your company details, branding and embed settings. This
              information is used on your intake form, BOQ page, PDF and client
              page.
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          <OrgSettingsForm
            slug={org.slug}
            initial={{
              name: org.name,
              tagline: org.tagline ?? "",
              primaryColor: org.primaryColor,
              phone: org.phone ?? "",
              email: org.email ?? "",
              website: org.website ?? "",
              logoUrl: org.logoUrl,
              offices: brand.offices,
            }}
          />
          <EmbedCode slug={org.slug} />
        </div>
      </div>
    </main>
  );
}
