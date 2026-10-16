import { cache } from "react";
import { cookies } from "next/headers";
import { prisma, type Organization } from "@vectroq/db";

export const ORG_COOKIE = "vq_org";
export const DEFAULT_ORG_SLUG = process.env.DEFAULT_ORG_SLUG ?? "demo";

export const getOrgBySlug = cache(async (slug: string) =>
  prisma.organization.findUnique({
    where: { slug: slug.trim().toLowerCase() },
  }),
);

// TEMPORARY: picks the tenant from a cookie (default org otherwise).
// Tier 2 item 6 (auth) replaces the body of this function with "the
// organization of the logged-in user". Nothing else needs to change.
export const getCurrentOrg = cache(async (): Promise<Organization> => {
  const jar = await cookies();
  const slug = jar.get(ORG_COOKIE)?.value ?? DEFAULT_ORG_SLUG;
  const org =
    (await getOrgBySlug(slug)) ?? (await getOrgBySlug(DEFAULT_ORG_SLUG));
  if (!org) {
    throw new Error(
      `Organization "${slug}" not found. Run the migration and pnpm seed-orgs.`,
    );
  }
  return org;
});
