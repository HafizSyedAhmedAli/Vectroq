// apps/web/src/lib/app-url.ts
/** Public base URL for links in emails. Never trust the Host header for this. */
export const appUrl = (req: Request) =>
  (process.env.APP_URL || new URL(req.url).origin).replace(/\/$/, "");
