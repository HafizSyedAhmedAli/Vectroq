import { OfficeNav } from "@/components/OfficeNav";
import { brandFromOrg, brandStyle } from "@/lib/brand";
import { requirePage } from "@/lib/org";

export const dynamic = "force-dynamic";

export default async function OfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await requirePage();
  const brand = brandFromOrg(auth.org);
  return (
    <div style={brandStyle(brand)}>
      <OfficeNav
        brand={brand}
        orgSlug={auth.org.slug}
        role={auth.role}
        userName={auth.user.name}
      />
      {children}
    </div>
  );
}
