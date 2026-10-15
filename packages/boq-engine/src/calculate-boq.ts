import type {
  BOQLineItem,
  BOQResult,
  Category,
  Geometry,
  RateCard,
  RateItemType,
} from "@tmcc/shared-types";
import {
  brickCount,
  cementBags,
  dryRoomArea,
  floorArea,
  netWallArea,
  openingArea,
  plasterArea,
  sandCft,
  steelMaterialTons,
  wetRoomArea,
} from "./material-quantities";

const bathroomCount = (g: Geometry) =>
  g.rooms.filter((r) => r.type === "bathroom").length;

// Category A houses get marble in living areas; B and C get tiles there.
// Kitchens and bathrooms are always tiled. Each floor area is charged ONCE.
const marbleArea = (g: Geometry, c: Category) =>
  c === "A" ? dryRoomArea(g) : 0;
const tileArea = (g: Geometry, c: Category) =>
  c === "A" ? wetRoomArea(g) : floorArea(g);

const QUANTITY_BASIS: Record<
  RateItemType,
  (g: Geometry, category: Category) => number
> = {
  masonry: netWallArea,
  plaster: plasterArea,
  shuttering: floorArea, // roof-slab centering
  steelFixing: steelMaterialTons, // labour on the same tonnage of steel
  sanitary: bathroomCount,
  tileFixing: tileArea,
  marbleFixing: marbleArea,
  woodwork: openingArea,
  falseCeiling: dryRoomArea,
  foundation: floorArea,
  rccRoof: floorArea,
  electrical: floorArea,
  paint: (g) => plasterArea(g) + floorArea(g), // walls (both faces) + ceilings
  brick: (g) => brickCount(g) / 1000, // priced per 1,000
  cement: cementBags,
  sand: sandCft,
  steelMaterial: steelMaterialTons,
};

export function calculateBoq(
  geometry: Geometry,
  rateCard: RateCard,
  taxPercent: number = rateCard.taxPercent ?? 0,
): BOQResult {
  const lineItems: BOQLineItem[] = rateCard.items
    .map((rateItem) => {
      const quantity = QUANTITY_BASIS[rateItem.itemType](
        geometry,
        rateCard.category,
      );
      return {
        itemType: rateItem.itemType,
        quantity,
        unit: rateItem.unit,
        unitRate: rateItem.unitRate,
        subtotal: quantity * rateItem.unitRate,
      };
    })
    .filter((item) => item.quantity > 0);

  const subtotal = lineItems.reduce((sum, item) => sum + item.subtotal, 0);
  const tax = subtotal * (taxPercent / 100);
  return { lineItems, subtotal, tax, total: subtotal + tax };
}
