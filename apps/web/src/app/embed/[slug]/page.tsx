import { notFound } from "next/navigation";
import { PublicIntake } from "@/components/intake/PublicIntake";
import { EmbedResizer } from "@/components/EmbedResizer";
import { brandFromOrg, brandStyle } from "@/lib/brand";
import { getOrgBySlug } from "@/lib/org";
import { resolveOrgRules } from "@vectroq/shared-types";

export const dynamic = "force-dynamic";

export default async function EmbedPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const org = await getOrgBySlug((await params).slug);
  if (!org) notFound();

  return (
    <div style={brandStyle(brandFromOrg(org))} className="p-2">
      <style>{"body{background:transparent!important}"}</style>
      <PublicIntake
        orgSlug={org.slug}
        models={resolveOrgRules(org.rules).models}
      />
      <EmbedResizer />
    </div>
  );
}
