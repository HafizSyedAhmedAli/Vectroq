import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@vectroq/db";
import { hasRole, type Role } from "@/lib/auth/roles";
import { getAuth, type AuthContext } from "@/lib/auth/session";

export const DEFAULT_ORG_SLUG = process.env.DEFAULT_ORG_SLUG ?? "demo";

export const getOrgBySlug = cache(async (slug: string) =>
  prisma.organization.findUnique({
    where: { slug: slug.trim().toLowerCase() },
  }),
);

/** For pages: the signed-in context, or a redirect. */
export async function requirePage(min: Role = "VIEWER"): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  if (!hasRole(auth.role, min)) redirect("/office");
  return auth;
}

/** Organization of the signed-in user (pages only; API routes use guard()). */
export const getCurrentOrg = cache(async () => (await requirePage()).org);
