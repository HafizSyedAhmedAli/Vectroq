// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { botSignals, MIN_FILL_MS, verifyTurnstile } from "./bot-check";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("botSignals", () => {
  it("passes a normal human submission", () => {
    expect(botSignals({ website: "", elapsedMs: 30_000 })).toBe("ok");
  });
  it("flags a filled honeypot", () => {
    expect(botSignals({ website: "http://spam", elapsedMs: 30_000 })).toBe(
      "honeypot",
    );
  });
  it("flags a too-fast or missing timer", () => {
    expect(botSignals({ website: "", elapsedMs: MIN_FILL_MS - 1 })).toBe(
      "too-fast",
    );
    expect(botSignals({ website: "" })).toBe("too-fast");
    expect(botSignals(undefined)).toBe("too-fast");
  });
});

describe("verifyTurnstile", () => {
  it("is skipped when no secret is configured", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    expect(await verifyTurnstile(undefined, "1.1.1.1")).toBe(true);
  });
  it("requires a token when configured", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    expect(await verifyTurnstile("", "1.1.1.1")).toBe(false);
  });
  it("follows Cloudflare's answer and fails closed on errors", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ json: async () => ({ success: true }) }),
    );
    expect(await verifyTurnstile("tok", "1.1.1.1")).toBe(true);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await verifyTurnstile("tok", "1.1.1.1")).toBe(false);
  });
});
