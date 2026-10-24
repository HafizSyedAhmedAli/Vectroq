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

function contrastWithWhite(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const lum =
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255);
  return 1.05 / (lum + 0.05);
}

/** Darkens a too-light brand color until white text on it is readable (AA). */
export function readableBrand(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  let c = hex;
  for (let i = 0; i < 30 && contrastWithWhite(c) < 4.5; i++)
    c = darken(c, 0.08);
  return c;
}

/** Overrides the Tailwind `brand` colors for everything inside the wrapper. */
export function brandStyle(brand: Brand): CSSProperties {
  const primary = readableBrand(brand.colors.primary);
  return {
    "--color-brand": primary,
    "--color-brand-dark": darken(primary),
  } as CSSProperties;
}
