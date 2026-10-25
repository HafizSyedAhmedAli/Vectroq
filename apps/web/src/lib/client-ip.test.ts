import { describe, it, expect } from "vitest";
import { clientIp } from "./client-ip";

const req = (h: Record<string, string>) => new Request("http://x", { headers: h });

describe("clientIp", () => {
  it("uses the first x-forwarded-for entry, trimmed", () => {
    expect(clientIp(req({ "x-forwarded-for": " 1.1.1.1 , 2.2.2.2" }))).toBe("1.1.1.1");
  });
  it("falls back to x-real-ip", () => {
    expect(clientIp(req({ "x-real-ip": "3.3.3.3" }))).toBe("3.3.3.3");
  });
  it("falls back to x-real-ip when x-forwarded-for is empty", () => {
    expect(clientIp(req({ "x-forwarded-for": "", "x-real-ip": "4.4.4.4" }))).toBe("4.4.4.4");
  });
  it("returns unknown with no headers", () => {
    expect(clientIp(req({}))).toBe("unknown");
  });
});
