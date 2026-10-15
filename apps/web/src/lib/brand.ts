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
  name: "BuildQuote", // placeholder
  tagline: "From plan to priced BOQ in minutes",
  description: "Upload a plan, get a priced Bill of Quantities and a 3D view.",
  logo: null, // e.g. { src: "/logo.png", width: 520, height: 119 } (PNG or JPG only, for the PDF)
  colors: { primary: "#2563eb" },
  contact: {},
  offices: [],
};
