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

/** Overrides the Tailwind `brand` colors for everything inside the wrapper. */
export function brandStyle(brand: Brand): CSSProperties {
  return {
    "--color-brand": brand.colors.primary,
    "--color-brand-dark": darken(brand.colors.primary),
  } as CSSProperties;
}
