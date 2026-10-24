import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vectroq/db";
import { cleanupExpiredDemos } from "@/lib/demo";

export const maxDuration = 60;

const AUDIT_RETENTION_MONTHS = 12;

// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - AUDIT_RETENTION_MONTHS);
  const now = new Date();

  const [audit, limits, sessions] = await Promise.all([
    prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.rateLimit.deleteMany({ where: { resetAt: { lt: now } } }),
    prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
  await cleanupExpiredDemos();

  return NextResponse.json({
    auditDeleted: audit.count,
    rateLimitsDeleted: limits.count,
    sessionsDeleted: sessions.count,
  });
}
