// apps/web/src/lib/rate-set-types.ts
import type { RateCardItem } from "@tmcc/shared-types";

export interface RateSourceItem {
  itemType: string;
  priceLocation?: string | null;
  scope?: "city" | "nearby" | "national" | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  sourceDate?: string | null;
  note?: string | null;
}

/** CSR imports store { document, year, importedAt }; manual sets store null. */
export interface RateSources {
  document?: string;
  year?: number;
  importedAt?: string;
  items?: RateSourceItem[];
  warnings?: string[];
}

export interface DraftRateSet {
  id: string;
  city: string;
  category: string;
  origin: string;
  createdAt: string;
  createdLabel?: string;
  items: RateCardItem[];
  sources: RateSources | null;
}

export interface ApprovedRateSet {
  id: string;
  city: string;
  category: string;
  origin: string;
  approvedBy: string;
  approvedLabel: string;
  approvedAt: string | null;
  items: RateCardItem[];
  sources: RateSources | null;
}

export const CSR_CSV_MAX_BYTES = 1024 * 1024; // 1 MB is far more than any city list needs
