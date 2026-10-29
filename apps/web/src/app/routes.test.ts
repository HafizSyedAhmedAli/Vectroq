// @vitest-environment node
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "../proxy";

const here = __dirname; // src/app

describe("routes referenced elsewhere exist", () => {
  it.each([
    "office/dashboard",
    "office/leads",
    "office/team",
    "office/rates",
    "office/rules",
    "office/settings",
    "office/billing",
    "office/audit",
    "office/account",
    "office/search",
    "office/admin",
    "office/[projectId]",
    "office/[projectId]/boq",
    "c/[slug]",
    "embed/[slug]",
    "client/[token]",
    "invite/[token]",
    "reset-password/[token]",
    "verify-email/[token]",
    "login",
    "signup",
    "demo",
    "forgot-password",
    "request",
  ])("%s has a page", (dir) => {
    expect(existsSync(join(here, dir, "page.tsx"))).toBe(true);
  });

  it("the vercel cron points at a real route with a valid schedule", () => {
    const vercel = JSON.parse(
      readFileSync(join(here, "../../vercel.json"), "utf8"),
    );
    for (const c of vercel.crons) {
      expect(c.schedule).toMatch(/^(\S+\s){4}\S+$/);
      expect(
        existsSync(
          join(
            here,
            c.path.replace(/^\//, "").replace(/^api\//, "api/"),
            "route.ts",
          ),
        ),
      ).toBe(true);
    }
  });

  it("the sign-in proxy covers the office and the tenant APIs", () => {
    expect(config.matcher).toEqual(
      expect.arrayContaining([
        "/office/:path*",
        "/api/projects/:path*",
        "/api/rate-sets/:path*",
        "/api/org/:path*",
        "/api/team/:path*",
      ]),
    );
  });
});
