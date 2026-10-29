import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import nextConfig from "./next.config";

const headers = async () =>
  (await nextConfig.headers!()) as {
    source: string;
    headers: { key: string; value: string }[];
  }[];
const find = async (source: string) =>
  (await headers()).find((h) => h.source === source)!;
const val = (h: { headers: { key: string; value: string }[] }, key: string) =>
  h.headers.find((x) => x.key === key)?.value;

describe("next.config", () => {
  it("allows framing only on the embed route", async () => {
    expect(val(await find("/embed/:path*"), "Content-Security-Policy")).toBe(
      "frame-ancestors *",
    );
    expect(val(await find("/((?!embed/).*)"), "Content-Security-Policy")).toBe(
      "frame-ancestors 'self'",
    );
  });

  it("the 'everything else' rule really excludes /embed/ paths", async () => {
    const re = new RegExp(`^${(await find("/((?!embed/).*)")).source}$`);
    expect(re.test("/embed/acme")).toBe(false);
    expect(re.test("/office/dashboard")).toBe(true);
    expect(re.test("/c/acme")).toBe(true);
  });

  it("sends the security headers on every path", async () => {
    const h = await find("/:path*");
    expect(val(h, "X-Content-Type-Options")).toBe("nosniff");
    expect(val(h, "Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(val(h, "Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=()",
    );
    const hsts = val(h, "Strict-Transport-Security")!;
    expect(Number(/max-age=(\d+)/.exec(hsts)![1])).toBeGreaterThanOrEqual(
      31_536_000,
    );
  });

  it("keeps native and PDF packages external", () => {
    expect(nextConfig.serverExternalPackages).toEqual(
      expect.arrayContaining(["sharp", "@react-pdf/renderer"]),
    );
  });

  it("transpiles every workspace package the app depends on", () => {
    const pkg = JSON.parse(
      readFileSync(join(__dirname, "package.json"), "utf8"),
    );
    const workspace = Object.keys(pkg.dependencies).filter((d) =>
      d.startsWith("@vectroq/"),
    );
    expect(workspace.length).toBeGreaterThan(0);
    for (const d of workspace)
      expect(nextConfig.transpilePackages).toContain(d);
    expect(nextConfig.transpilePackages).toContain("@vectroq/boq-engine"); // used via rate-cards
  });
});
