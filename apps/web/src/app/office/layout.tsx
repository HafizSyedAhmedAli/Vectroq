import { OfficeNav } from "@/components/OfficeNav";
import { brandFromOrg, brandStyle } from "@/lib/brand";
import { getCurrentOrg } from "@/lib/org";

export const dynamic = "force-dynamic";

export default async function OfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const org = await getCurrentOrg();
  const brand = brandFromOrg(org);
  return (
    <div style={brandStyle(brand)}>
      <OfficeNav brand={brand} orgSlug={org.slug} />
      {children}
    </div>
  );
}
