import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { config, proxy } from "./proxy";

const req = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : {},
  });

describe("proxy", () => {
  it("passes through when session cookie present", () => {
    const res = proxy(req("/office", "vq_session=abc"));
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
  it("401 JSON for API paths without cookie", async () => {
    const res = proxy(req("/api/projects/1"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Sign in required." });
  });
  it("redirects pages to /login with next param", () => {
    const res = proxy(req("/office/rules"));
    expect(res.status).toBe(307);
    const loc = new URL(res.headers.get("location")!);
    expect(loc.pathname).toBe("/login");
    expect(loc.searchParams.get("next")).toBe("/office/rules");
  });
  it("matcher covers protected routes", () => {
    expect(config.matcher).toContain("/office/:path*");
    expect(config.matcher).toContain("/api/leads/:id/plan");
  });
});
