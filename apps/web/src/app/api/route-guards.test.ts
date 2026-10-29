// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = __dirname; // src/app/api
const walk = (d: string): string[] =>
  readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const routes = walk(root)
  .filter((p) => p.endsWith(`${sep}route.ts`))
  .map((p) => relative(root, p).split(sep).join("/"));
const src = (r: string) => readFileSync(join(root, r), "utf8");

// Routes without guard(): each must carry a different, named protection.
const PUBLIC: Record<string, string> = {
  "auth/signup/route.ts": "rateLimit(",
  "auth/login/route.ts": "rateLimit(",
  "auth/logout/route.ts": "destroySession",
  "auth/forgot/route.ts": "rateLimit(",
  "auth/reset/route.ts": "tokenHash",
  "auth/verify-email/route.ts": "tokenHash",
  "invites/accept/route.ts": "tokenHash",
  "leads/route.ts": "rateLimit(",
  "share/[token]/boq-pdf/route.ts": "shareExpiresAt",
  "stripe/webhook/route.ts": "constructEvent",
  "cron/cleanup/route.ts": "CRON_SECRET",
  "demo/start/route.ts": "rateLimit(",
};
// Signed-in users may write with only the default (viewer) role here.
const VIEWER_WRITE_OK = [
  "auth/change-password/route.ts",
  "auth/verify-email/send/route.ts",
];

describe("API route protection", () => {
  it("finds the routes", () => expect(routes.length).toBeGreaterThan(20));

  it("every route is guarded or on the documented public list", () => {
    const unguarded = routes.filter(
      (r) => !src(r).includes("guard(") && !(r in PUBLIC),
    );
    expect(unguarded).toEqual([]);
  });

  it("every public route has its own protection", () => {
    for (const [route, proof] of Object.entries(PUBLIC))
      expect(src(route)).toContain(proof);
  });

  it("the public list has no stale entries", () => {
    for (const r of Object.keys(PUBLIC)) expect(routes).toContain(r);
  });

  it("guarded routes that touch tenant data scope it to the organization", () => {
    const bad = routes.filter((r) => {
      const s = src(r);
      return (
        s.includes("guard(") &&
        /prisma\.(project|lead|cadFile|rateSet)\./.test(s) &&
        !s.includes("organizationId")
      );
    });
    expect(bad).toEqual([]);
  });

  it("routes that write require at least the estimator role", () => {
    const bad = routes.filter((r) => {
      const s = src(r);
      if (!s.includes("guard(") || VIEWER_WRITE_OK.includes(r)) return false;
      if (!/export\s+async\s+function\s+(POST|PATCH|PUT|DELETE)\b/.test(s))
        return false;
      const roles = [...s.matchAll(/guard\(([^)]*)\)/g)].map((m) =>
        m[1].replace(/["'\s]/g, ""),
      );
      return !roles.some((x) => x === "ESTIMATOR" || x === "OWNER");
    });
    expect(bad).toEqual([]);
  });
});
