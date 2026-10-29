// @vitest-environment node
import { describe, it, expect, afterEach } from "vitest";
import { appUrl } from "./app-url";

const SAVED = process.env.APP_URL;
afterEach(() => {
  if (SAVED === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = SAVED;
});
const req = (url = "http://localhost:3000/api/x") => new Request(url);

describe("appUrl", () => {
  it("uses APP_URL and strips one trailing slash", () => {
    process.env.APP_URL = "https://app.test/";
    expect(appUrl(req())).toBe("https://app.test");
  });

  it("falls back to the request origin when APP_URL is unset", () => {
    delete process.env.APP_URL;
    expect(appUrl(req("https://x.dev/api/y?z=1"))).toBe("https://x.dev");
  });

  it("ignores a spoofed Host header", () => {
    process.env.APP_URL = "https://app.test";
    const r = new Request("http://localhost:3000/x", {
      headers: { host: "evil.com", "x-forwarded-host": "evil.com" },
    });
    expect(appUrl(r)).toBe("https://app.test");
  });

  it("treats an empty APP_URL as unset (fails until the fix in section 9)", () => {
    process.env.APP_URL = "";
    expect(appUrl(req())).toBe("http://localhost:3000");
  });
});
