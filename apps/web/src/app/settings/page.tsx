import Link from "next/link";
import { OrgSettingsForm } from "@/components/OrgSettingsForm";
import { SiteFooter } from "@/components/SiteFooter";
import { brandFromOrg } from "@/lib/brand";
import { getCurrentOrg } from "@/lib/org";
import { EmbedCode } from "@/components/EmbedCode";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const org = await getCurrentOrg();
  const brand = brandFromOrg(org);
  return (
    <>
      <main className="mx-auto min-h-[calc(100vh-72px)] max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-extrabold text-brand-black">
          Company settings
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          Used on your intake form, BOQ page, PDF and client page. Your public
          form:{" "}
          <Link className="text-brand underline" href={`/c/${org.slug}`}>
            /c/{org.slug}
          </Link>
        </p>
        <div className="mt-8">
          <OrgSettingsForm
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
      </main>
      <SiteFooter brand={brand} />
    </>
  );
}
