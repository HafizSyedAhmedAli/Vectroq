import type { CSSProperties } from "react";
import type { Organization } from "@vectroq/db";

export interface Brand {
  name: string;
  tagline: string;
  description: string;
  logoUrl: string | null;
  colors: { primary: string };
  contact: { phone?: string; email?: string; website?: string };
  offices: { title: string; address: string }[];
}

/** The Vectroq product itself (landing page, metadata). */
export const platformBrand: Brand = {
  name: "Vectroq",
  tagline: "From floor plan to final quote.",
  description:
    "Vectroq turns a floor plan into a priced Bill of Quantities and a 3D view in minutes.",
  logoUrl: "/logo.png",
  colors: { primary: "#2563EB" },
  contact: { website: "vectroq.vercel.app" },
  offices: [],
};

/** A customer company's identity, read from its Organization row. */
export function brandFromOrg(org: Organization): Brand {
  return {
    name: org.name,
    tagline: org.tagline ?? "",
    description: `${org.name}: priced estimates and 3D views from your floor plan.`,
    logoUrl: org.logoUrl,
    colors: { primary: org.primaryColor },
    contact: {
      phone: org.phone ?? undefined,
      email: org.email ?? undefined,
      website: org.website ?? undefined,
    },
    offices: Array.isArray(org.offices)
      ? (org.offices as { title: string; address: string }[])
      : [],
  };
}

function darken(hex: string, amount = 0.15): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) =>
    Math.round(((n >> shift) & 255) * (1 - amount))
      .toString(16)
      .padStart(2, "0");
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

export function contrastRatio(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function contrastWithWhite(hex: string): number {
  return contrastRatio(hex, "#ffffff");
}

function lighten(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => {
    const v = (n >> shift) & 255;
    return Math.round(v + (255 - v) * t)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Card color of the dark theme (must match --color-white in globals.css). */
export const DARK_SURFACE = "#0c1833";

/** Darkens a too-light brand color until white text on it is readable (AA). */
export function readableBrand(hex: string): string {
  if (!HEX.test(hex)) return hex;
  let c = hex;
  for (let i = 0; i < 30 && contrastWithWhite(c) < 4.5; i++)
    c = darken(c, 0.08);
  return c;
}

/** Brand as TEXT / border on the dark surface: lightened until it reads (4.5:1). */
export function brandOnDark(hex: string): string {
  if (!HEX.test(hex)) return "#93c5fd";
  let c = hex;
  for (let i = 0; i < 40 && contrastRatio(c, DARK_SURFACE) < 4.5; i++)
    c = lighten(c, 0.08);
  return c;
}

/**
 * Brand as a FILL (buttons) in dark mode: lifted off the dark surface (3:1)
 * but never so light that white text on it stops being readable (4.5:1).
 */
export function brandFillOnDark(hex: string): string {
  if (!HEX.test(hex)) return hex;
  let c = readableBrand(hex);
  for (let i = 0; i < 40 && contrastRatio(c, DARK_SURFACE) < 3; i++) {
    const next = lighten(c, 0.04);
    if (contrastWithWhite(next) < 4.5) break;
    c = next;
  }
  return c;
}

/** Overrides the Tailwind `brand` colors for everything inside the wrapper. */
export function brandStyle(brand: Brand): CSSProperties {
  const primary = readableBrand(brand.colors.primary);
  const fill = brandFillOnDark(primary);
  return {
    "--color-brand": primary,
    "--color-brand-dark": darken(primary),
    // used only while dark mode is on (see globals.css)
    "--vq-brand-dm": fill,
    "--vq-brand-dm-dark": darken(fill),
    "--vq-brand-fg": brandOnDark(primary),
  } as CSSProperties;
}