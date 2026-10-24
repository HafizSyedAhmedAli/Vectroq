export const MIN_FILL_MS = 4000;

export type BotVerdict = "ok" | "honeypot" | "too-fast";

/**
 * `website` is a hidden field real users never fill.
 * `elapsedMs` is how long the form was open. Both are client-reported, so
 * they only stop lazy bots. The rate limiter and Turnstile are the real defence.
 */
export function botSignals(bot: unknown): BotVerdict {
  const b = (bot ?? {}) as { website?: unknown; elapsedMs?: unknown };
  if (typeof b.website === "string" && b.website.trim() !== "")
    return "honeypot";
  if (typeof b.elapsedMs !== "number" || b.elapsedMs < MIN_FILL_MS)
    return "too-fast";
  return "ok";
}

/** Cloudflare Turnstile. Skipped (returns true) when no secret is configured. */
export async function verifyTurnstile(
  token: unknown,
  ip: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (typeof token !== "string" || !token) return false;
  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      },
    );
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false; // secret is set, so fail closed
  }
}
