import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vectroq/db";
import {
  hashPassword,
  validatePassword,
  verifyPassword,
} from "@/lib/auth/credentials";
import { createSession } from "@/lib/auth/session";
import { sha256 } from "@/lib/auth/tokens";

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const fail = (error: string, status = 400) =>
    NextResponse.json({ error }, { status });

  const token = typeof b?.token === "string" ? b.token : "";
  const password = typeof b?.password === "string" ? b.password : "";

  const inv = token
    ? await prisma.invitation.findUnique({
        where: { tokenHash: sha256(token) },
      })
    : null;
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date())
    return fail("This invitation is no longer valid.", 410);

  const existing = await prisma.user.findUnique({
    where: { email: inv.email },
  });
  let userId: string;

  if (existing) {
    if (!(await verifyPassword(password, existing.passwordHash)))
      return fail("Wrong password.", 401);
    userId = existing.id;
  } else {
    const name = typeof b?.name === "string" ? b.name.trim() : "";
    if (!name || name.length > 100) return fail("Your name is required.");
    const pwError = validatePassword(password);
    if (pwError) return fail(pwError);
    const user = await prisma.user.create({
      data: {
        email: inv.email,
        name,
        passwordHash: await hashPassword(password),
        emailVerifiedAt: new Date(),
      },
    });
    userId = user.id;
  }

  await prisma.$transaction([
    prisma.membership.upsert({
      where: {
        userId_organizationId: { userId, organizationId: inv.organizationId },
      },
      update: {},
      create: { userId, organizationId: inv.organizationId, role: inv.role },
    }),
    prisma.invitation.update({
      where: { id: inv.id },
      data: { acceptedAt: new Date() },
    }),
  ]);

  await createSession(userId, inv.organizationId);
  return NextResponse.json({ ok: true });
}
