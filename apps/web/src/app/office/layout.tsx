import { OfficeShell } from "@/components/OfficeShell";
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
      <OfficeShell
        brand={brand}
        orgSlug={auth.org.slug}
        role={auth.role}
        userName={auth.user.name}
        userEmail={auth.user.email}
        demoExpiresLabel={
          auth.org.isDemo && auth.org.demoExpiresAt
            ? auth.org.demoExpiresAt.toLocaleString("en-PK", {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : null
        }
        emailVerified={auth.user.emailVerified}
      >
        {children}
      </OfficeShell>
    </div>
  );
}
