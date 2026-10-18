// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  hashPassword,
  isEmail,
  validatePassword,
  verifyPassword,
} from "./credentials";

describe("passwords", () => {
  it("verifies the right password only", async () => {
    const h = await hashPassword("correct horse");
    expect(await verifyPassword("correct horse", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });
  it("salts every hash", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });
  it("enforces a minimum length", () => {
    expect(validatePassword("short")).not.toBeNull();
    expect(validatePassword("long enough")).toBeNull();
  });
  it("validates emails", () => {
    expect(isEmail("a@b.co")).toBe(true);
    expect(isEmail("nope")).toBe(false);
  });

  it("still verifies legacy salt:key hashes", async () => {
    const { randomBytes, scryptSync } = await import("node:crypto");
    const salt = randomBytes(16);
    const legacy = `${salt.toString("hex")}:${scryptSync("old pw", salt, 64).toString("hex")}`;
    expect(await verifyPassword("old pw", legacy)).toBe(true);
    expect(await verifyPassword("wrong", legacy)).toBe(false);
  });
});
