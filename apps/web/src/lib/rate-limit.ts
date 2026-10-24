import { NextResponse } from "next/server";
import { Prisma, prisma } from "@vectroq/db";

export { clientIp } from "./client-ip";

export interface RateResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * Fixed-window counter in one atomic SQL statement.
 * Fails OPEN: if the database errors, the request is allowed (and logged),
 * so a limiter problem never takes the site down.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateResult> {
  try {
    const rows = await prisma.$queryRaw<{ count: number; retry: number }[]>(
      Prisma.sql`
        INSERT INTO "RateLimit" ("key", "count", "resetAt")
        VALUES (${key}, 1, NOW() + make_interval(secs => ${windowSec}::double precision))
        ON CONFLICT ("key") DO UPDATE SET
          "count" = CASE WHEN "RateLimit"."resetAt" <= NOW() THEN 1 ELSE "RateLimit"."count" + 1 END,
          "resetAt" = CASE WHEN "RateLimit"."resetAt" <= NOW()
                           THEN NOW() + make_interval(secs => ${windowSec}::double precision)
                           ELSE "RateLimit"."resetAt" END
        RETURNING "count", CEIL(EXTRACT(EPOCH FROM ("resetAt" - NOW())))::int AS retry
      `,
    );
    const { count, retry } = rows[0];

    // Housekeeping: now and then, drop expired rows.
    if (Math.random() < 0.01) {
      void prisma.rateLimit
        .deleteMany({ where: { resetAt: { lt: new Date() } } })
        .catch(() => {});
    }

    return {
      ok: count <= limit,
      remaining: Math.max(0, limit - count),
      retryAfterSec: Math.max(1, retry),
    };
  } catch (err) {
    console.error("Rate limiter failed, allowing request", err);
    return { ok: true, remaining: limit, retryAfterSec: 0 };
  }
}

export function tooMany(r: RateResult, message?: string) {
  const mins = Math.ceil(r.retryAfterSec / 60);
  return NextResponse.json(
    {
      error:
        message ??
        `Too many attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`,
    },
    { status: 429, headers: { "Retry-After": String(r.retryAfterSec) } },
  );
}
