import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@vectroq/db";
import { guard } from "@/lib/auth/guard";
import {
  hashPassword,
  validatePassword,
  verifyPassword,
} from "@/lib/auth/credentials";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { sha256 } from "@/lib/auth/tokens";
import { sendEmail } from "@/lib/email";
import { passwordChangedEmail } from "@/lib/email-templates";
import { appUrl } from "@/lib/app-url";

export async function POST(req: NextRequest) {
  const g = await guard("VIEWER");
  if (!g.ok) return g.res;
  const { user: me } = g.auth;

  const b = await req.json().catch(() => null);
  const current =
    typeof b?.currentPassword === "string" ? b.currentPassword : "";
  const next = b?.newPassword;
  const fail = (error: string) => NextResponse.json({ error }, { status: 400 });

  if (!current) return fail("Enter your current password.");
  const pwError = validatePassword(next);
  if (pwError) return fail(pwError);

  const user = await prisma.user.findUnique({ where: { id: me.id } });
  if (!user || !(await verifyPassword(current, user.passwordHash)))
    return fail("Your current password is wrong.");
  if (next === current)
    return fail("Choose a password different from your current one.");

  const passwordHash = await hashPassword(next);
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const keep = token ? sha256(token) : undefined;

  // Change the password and sign out every OTHER device (keep this one).
  await prisma.$transaction([
    prisma.user.update({ where: { id: me.id }, data: { passwordHash } }),
    prisma.session.deleteMany({
      where: { userId: me.id, ...(keep ? { id: { not: keep } } : {}) },
    }),
  ]);

  try {
    await sendEmail({
      to: me.email,
      ...passwordChangedEmail(`${appUrl(req)}/forgot-password`),
    });
  } catch (err) {
    console.error("Password-changed email failed", err);
  }

  return NextResponse.json({ ok: true });
}
