import { NextResponse } from "next/server";
import { Prisma, prisma } from "@vectroq/db";

export { clientIp } from "./client-ip";

export interface RateResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

const memory = new Map<string, { count: number; resetAt: number }>();

/** Per-instance fallback used only when the database is unreachable. */
function memoryLimit(
  key: string,
  limit: number,
  windowSec: number,
): RateResult {
  const now = Date.now();
  if (memory.size > 5000) {
    for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
  }
  let e = memory.get(key);
  if (!e || e.resetAt <= now) {
    e = { count: 0, resetAt: now + windowSec * 1000 };
    memory.set(key, e);
  }
  e.count++;
  return {
    ok: e.count <= limit,
    remaining: Math.max(0, limit - e.count),
    retryAfterSec: Math.max(1, Math.ceil((e.resetAt - now) / 1000)),
  };
}

/**
 * Fixed-window counter in one atomic SQL statement.
 * Falls back to an in-memory counter: if the database errors, the request is allowed (and logged),
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
    console.error("Rate limiter DB failed, using in-memory fallback", err);
    return memoryLimit(key, limit, windowSec);
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
