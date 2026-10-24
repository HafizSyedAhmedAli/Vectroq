/** Vercel sets x-forwarded-for itself. Behind any other proxy, make sure it can't be spoofed. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  return (
    xff?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown"
  );
}
