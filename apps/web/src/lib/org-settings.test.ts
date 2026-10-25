import { describe, it, expect } from "vitest";
import { validateOrgSettings } from "./org-settings";

const base = { name: "Acme", primaryColor: "#2563EB" };
const err = (r: ReturnType<typeof validateOrgSettings>) => (r.ok ? null : r.error);

describe("validateOrgSettings", () => {
  it("accepts a minimal valid input and nulls optional fields", () => {
    const r = validateOrgSettings(base);
    expect(r).toEqual({
      ok: true,
      data: { name: "Acme", tagline: null, primaryColor: "#2563EB", phone: null, email: null, website: null, offices: [] },
    });
  });
  it("trims strings", () => {
    const r = validateOrgSettings({ ...base, name: "  Acme  ", tagline: " Hi " });
    expect(r.ok && r.data.name).toBe("Acme");
    expect(r.ok && r.data.tagline).toBe("Hi");
  });
  it("rejects null/non-object input", () => {
    expect(validateOrgSettings(null).ok).toBe(false);
    expect(validateOrgSettings("x").ok).toBe(false);
  });
  it("rejects empty or too-long name", () => {
    expect(err(validateOrgSettings({ ...base, name: "  " }))).toMatch(/Company name/);
    expect(validateOrgSettings({ ...base, name: "a".repeat(101) }).ok).toBe(false);
    expect(validateOrgSettings({ ...base, name: "a".repeat(100) }).ok).toBe(true);
  });
  it.each(["2563EB", "#fff", "#GGGGGG", 123, undefined])("rejects bad color %s", (c) => {
    expect(err(validateOrgSettings({ ...base, primaryColor: c }))).toMatch(/Brand color/);
  });
  it("rejects over-long or non-string contact fields", () => {
    expect(err(validateOrgSettings({ ...base, tagline: "a".repeat(121) }))).toMatch(/too long/);
    expect(validateOrgSettings({ ...base, phone: "1".repeat(41) }).ok).toBe(false);
    expect(validateOrgSettings({ ...base, email: 5 }).ok).toBe(false);
    expect(validateOrgSettings({ ...base, website: "w".repeat(101) }).ok).toBe(false);
  });
  it("accepts offices, skipping fully empty ones", () => {
    const r = validateOrgSettings({ ...base, offices: [{ title: " HQ ", address: " Karachi " }, { title: "", address: "" }] });
    expect(r.ok && r.data.offices).toEqual([{ title: "HQ", address: "Karachi" }]);
  });
  it("rejects half-filled or oversized offices and more than 5", () => {
    expect(err(validateOrgSettings({ ...base, offices: [{ title: "HQ", address: "" }] }))).toMatch(/title and an address/);
    expect(validateOrgSettings({ ...base, offices: [{ title: "t".repeat(61), address: "a" }] }).ok).toBe(false);
    expect(validateOrgSettings({ ...base, offices: [{ title: "t", address: "a".repeat(201) }] }).ok).toBe(false);
    const six = Array.from({ length: 6 }, () => ({ title: "t", address: "a" }));
    expect(err(validateOrgSettings({ ...base, offices: six }))).toMatch(/At most 5/);
  });
  it("treats non-array offices as none", () => {
    const r = validateOrgSettings({ ...base, offices: "nope" });
    expect(r.ok && r.data.offices).toEqual([]);
  });
});
