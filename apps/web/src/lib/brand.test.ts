import { describe, it, expect } from "vitest";
import {
  DARK_SURFACE,
  brandFillOnDark,
  brandFromOrg,
  brandOnDark,
  brandStyle,
  contrastRatio,
  platformBrand,
  readableBrand,
} from "./brand";

const COLORS = [
  "#2563EB",
  "#0B1F44",
  "#FFD400",
  "#16A34A",
  "#7C3AED",
  "#DC2626",
  "#000000",
  "#FFFFFF",
  "#F5F5DC",
];

describe("brand colors in dark mode", () => {
  it.each(COLORS)("%s: text version is readable on the dark surface", (c) => {
    expect(contrastRatio(brandOnDark(c), DARK_SURFACE)).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it.each(COLORS)(
    "%s: fill keeps white text readable and stands off the card",
    (c) => {
      const fill = brandFillOnDark(c);
      expect(contrastRatio(fill, "#ffffff")).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(fill, DARK_SURFACE)).toBeGreaterThanOrEqual(3);
    },
  );
});

describe("brandFromOrg", () => {
  const org = (o: Record<string, unknown> = {}) =>
    ({
      name: "Acme Builders",
      tagline: null,
      logoUrl: null,
      primaryColor: "#0B1F44",
      phone: null,
      email: null,
      website: null,
      offices: null,
      ...o,
    }) as any;

  it("maps nulls to empty/undefined values", () => {
    const b = brandFromOrg(org());
    expect(b).toMatchObject({
      name: "Acme Builders",
      tagline: "",
      logoUrl: null,
      colors: { primary: "#0B1F44" },
      contact: { phone: undefined, email: undefined, website: undefined },
      offices: [],
    });
    expect(b.description).toContain("Acme Builders");
  });
  it("passes contact details and offices through", () => {
    const offices = [{ title: "HQ", address: "Karachi" }];
    const b = brandFromOrg(org({ tagline: "Build", phone: "1", email: "a@b.c", website: "x.com", offices }));
    expect(b.tagline).toBe("Build");
    expect(b.contact).toEqual({ phone: "1", email: "a@b.c", website: "x.com" });
    expect(b.offices).toBe(offices);
  });
  it("platformBrand is Vectroq", () => {
    expect(platformBrand.name).toBe("Vectroq");
  });
});

describe("readableBrand / brandStyle", () => {
  it("darkens light colors until white text reaches 4.5:1", () => {
    for (const c of ["#FFD400", "#F5F5DC", "#FFFFFF"]) {
      expect(contrastRatio(readableBrand(c), "#ffffff")).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("keeps already-readable colors and ignores invalid hex", () => {
    expect(readableBrand("#0B1F44")).toBe("#0B1F44");
    expect(readableBrand("red")).toBe("red");
    expect(brandOnDark("red")).toBe("#93c5fd");
    expect(brandFillOnDark("red")).toBe("red");
  });
  it("brandStyle returns all CSS variables as hex", () => {
    const st = brandStyle({ ...platformBrand, colors: { primary: "#FFD400" } }) as Record<string, string>;
    for (const k of ["--color-brand", "--color-brand-dark", "--vq-brand-dm", "--vq-brand-dm-dark", "--vq-brand-fg"]) {
      expect(st[k]).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(contrastRatio(st["--color-brand"], "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(st["--vq-brand-fg"], DARK_SURFACE)).toBeGreaterThanOrEqual(4.5);
  });
});
