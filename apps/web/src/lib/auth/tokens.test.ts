import { describe, expect, it } from "vitest";
import { newToken, sha256 } from "./tokens";

describe("tokens", () => {
  it("sha256 is deterministic hex of 64 chars", () => {
    expect(sha256("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(sha256("abc")).toHaveLength(64);
  });
  it("newToken is url-safe, unique, and respects byte length", () => {
    const a = newToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a).toHaveLength(43); // 32 bytes base64url
    expect(newToken()).not.toBe(a);
    expect(newToken(16)).toHaveLength(22);
  });
});
