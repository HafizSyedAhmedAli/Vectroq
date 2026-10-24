import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit, tooMany } from "@/lib/rate-limit";
import { prisma } from "@vectroq/db";
import {
  hashPassword,
  normalizeEmail,
  verifyPassword,
} from "@/lib/auth/credentials";
import { createSession } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

// Verified when the email is unknown, so response time doesn't reveal accounts.
const dummyHash = hashPassword("not-a-real-password");

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const email = normalizeEmail(b?.email);
  const ip = clientIp(req);
  const byIp = await rateLimit(`login:ip:${ip}`, 30, 900);
  if (!byIp.ok) return tooMany(byIp);
  if (email) {
    const byAcct = await rateLimit(`login:${ip}:${email}`, 8, 900);
    if (!byAcct.ok) return tooMany(byAcct);
  }
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

  await audit(
    {
      org: { id: membership.organizationId },
      user: { id: user.id, email: user.email },
    },
    "LOGIN",
    "User",
    user.id,
    { ip },
  );
  return NextResponse.json({ ok: true });
}
