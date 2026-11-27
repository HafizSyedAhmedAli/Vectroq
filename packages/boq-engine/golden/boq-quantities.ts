// Shared by the capture script and the preservation test: BOQ numbers for a Geometry.
import type { Geometry, RateCard, RateCardItem } from "@vectroq/shared-types";
import { RATE_ITEM_TYPES } from "@vectroq/shared-types";
import {
  brickCount,
  calculateBoq,
  floorArea,
  netWallArea,
  openingArea,
  plasterArea,
  wallFaceArea,
} from "../src/index";

const UNIT: Record<string, RateCardItem["unit"]> = {
  steelFixing: "ton",
  steelMaterial: "ton",
  sanitary: "bath",
  brick: "1000nos",
  cement: "bag",
  sand: "cft",
};
const CARD = {
  city: "X",
  category: "standard",
  items: RATE_ITEM_TYPES.map((itemType) => ({
    itemType,
    unit: UNIT[itemType] ?? "sqft",
    unitRate: 10,
  })),
} as unknown as RateCard;

export function boqQuantities(g: Geometry) {
  return {
    wallFaceArea: wallFaceArea(g),
    openingArea: openingArea(g),
    netWallArea: netWallArea(g),
    plasterArea: plasterArea(g),
    floorArea: floorArea(g),
    brickCount: brickCount(g),
    boq: calculateBoq(g, CARD, 0),
  };
}
