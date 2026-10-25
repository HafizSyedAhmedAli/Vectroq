import { describe, it, expect } from "vitest";
import {
  DARK_SURFACE,
  brandFillOnDark,
  brandOnDark,
  contrastRatio,
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
