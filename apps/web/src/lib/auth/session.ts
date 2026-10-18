import { cache } from "react";
import { cookies } from "next/headers";
import { prisma, type Organization } from "@vectroq/db";
import { isRole, type Role } from "./roles";
import { newToken, sha256 } from "./tokens";

export const SESSION_COOKIE = "vq_session";
const MAX_AGE_S = 60 * 60 * 24 * 30;
const SHORT_S = 60 * 60 * 24; // 1 day when "Remember me" is off

export interface AuthContext {
  user: { id: string; email: string; name: string };
  org: Organization;
  role: Role;
}

/** Call from route handlers only (it sets a cookie). */
export async function createSession(
  userId: string,
  organizationId: string,
  remember = true,
) {
  const token = newToken();
  const seconds = remember ? MAX_AGE_S : SHORT_S;
  await prisma.session.create({
    data: {
      id: sha256(token),
      userId,
      organizationId,
      expiresAt: new Date(Date.now() + seconds * 1000),
    },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(remember ? { maxAge: MAX_AGE_S } : {}),
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user, active company and role, or null. Role is read fresh. */
export const getAuth = cache(async (): Promise<AuthContext | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const s = await prisma.session.findUnique({
    where: { id: sha256(token) },
    include: { user: true },
  });
  if (!s || s.expiresAt < new Date()) return null;

  const m = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: s.userId,
        organizationId: s.organizationId,
      },
    },
    include: { organization: true },
  });
  if (!m || !isRole(m.role)) return null;

  return {
    user: { id: s.user.id, email: s.user.email, name: s.user.name },
    org: m.organization,
    role: m.role,
  };
});
