// apps/web/src/lib/brand.ts
// Single source of truth for product identity. Replace the placeholders once
// you pick the real product name (Tier 1, item 3).

export interface Brand {
  name: string;
  tagline: string;
  description: string;
  /** Set to null to show the name as text instead of a logo image. */
  logo: { src: string; width: number; height: number } | null;
  colors: { primary: string };
  contact: { phone?: string; email?: string; website?: string };
  offices: { title: string; address: string }[];
}

export const brand: Brand = {
  name: "Vectroq",
  tagline: "From floor plan to final quote.",
  description:
    "Vectroq turns a floor plan into a priced Bill of Quantities and a 3D view in minutes.",
  logo: { src: "/logo.png", width: 1560, height: 410 },
  colors: { primary: "#2563EB" },
  contact: { website: "vectroq.vercel.app" },
  offices: [],
};
