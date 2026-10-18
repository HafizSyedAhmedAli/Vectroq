import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vectroq/db";
import {
  hashPassword,
  normalizeEmail,
  verifyPassword,
} from "@/lib/auth/credentials";
import { createSession } from "@/lib/auth/session";

// Verified when the email is unknown, so response time doesn't reveal accounts.
const dummyHash = hashPassword("not-a-real-password");

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const email = normalizeEmail(b?.email);
  const password = typeof b?.password === "string" ? b.password : "";

  const user = email
    ? await prisma.user.findUnique({
        where: { email },
        include: { memberships: { orderBy: { createdAt: "asc" }, take: 1 } },
      })
    : null;

  const ok = await verifyPassword(
    password,
    user?.passwordHash ?? (await dummyHash),
  );
  const membership = user?.memberships[0];
  if (!user || !ok || !membership) {
    return NextResponse.json(
      { error: "Wrong email or password." },
      { status: 401 },
    );
  }

  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await createSession(
    user.id,
    membership.organizationId,
    b?.remember !== false,
  );
  return NextResponse.json({ ok: true });
}
