import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vectroq/db";
import { sha256 } from "@/lib/auth/tokens";

const invalid = () =>
  NextResponse.json(
    { error: "This confirmation link is invalid or has expired." },
    { status: 410 },
  );

// Public on purpose: the link may be opened on another device.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const token = typeof b?.token === "string" ? b.token : "";

  const row = token
    ? await prisma.emailVerification.findUnique({
        where: { tokenHash: sha256(token) },
      })
    : null;
  if (!row || row.usedAt || row.expiresAt < new Date()) return invalid();

  let claimed = false;
  await prisma.$transaction(async (tx) => {
    // Atomic claim: if two requests race, only one gets count === 1.
    const res = await tx.emailVerification.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (res.count !== 1) return;
    claimed = true;
    await tx.user.update({
      where: { id: row.userId },
      data: { emailVerifiedAt: new Date() },
    });
    await tx.emailVerification.deleteMany({
      where: { userId: row.userId, id: { not: row.id } },
    });
  });

  return claimed ? NextResponse.json({ ok: true }) : invalid();
}
