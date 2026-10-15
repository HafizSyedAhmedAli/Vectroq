// packages/lead-intake/src/options.ts

import { CITY_NAMES } from "@tmcc/shared-types";

// Every city in Pakistan, A to Z (see @tmcc/shared-types pakistan-cities.ts).
// A city can be servable for intake before a rate card exists for it (NFR-4):
// rates are searched live and nearby markets are used when the city has none.
export const CITIES: readonly string[] = CITY_NAMES;
export type City = string;

export const HOUSE_TYPES = ["House", "Villa", "Farmhouse"] as const;
export type HouseType = (typeof HOUSE_TYPES)[number];

export const FLOOR_OPTIONS = [1, 2, 3, 4] as const;
export const BEDROOM_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

// Assumption, not confirmed with TM CC: these bands and timelines are
// placeholders. Confirm the real ranges with the sales team.
export const BUDGET_RANGES = [
  "Under Rs 50 lakh",
  "Rs 50 lakh – 1 crore",
  "Rs 1 – 2 crore",
  "Rs 2 – 5 crore",
  "Above Rs 5 crore",
] as const;
export type BudgetRange = (typeof BUDGET_RANGES)[number];

export const TIMELINES = [
  "As soon as possible",
  "Within 3 months",
  "3 – 6 months",
  "6 – 12 months",
  "Just exploring",
] as const;
export type Timeline = (typeof TIMELINES)[number];

export const MAX_NOTES_LENGTH = 500;
