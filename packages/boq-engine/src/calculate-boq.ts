import type {
  BOQLineItem,
  BOQResult,
  BoqConfig,
  Category,
  Geometry,
  RateCard,
  RateItemType,
} from "@vectroq/shared-types";
import {
  MATERIAL_ASSUMPTIONS,
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

const DEFAULT_MARBLE_CATEGORIES: readonly Category[] = ["A"];

type Cfg = Required<BoqConfig>;

const bathroomCount = (g: Geometry) =>
  g.rooms.filter((r) => r.type === "bathroom").length;

// Categories listed in cfg.marbleCategories get marble in living areas; the
// rest get tiles there. Kitchens and bathrooms are always tiled. Each floor
// area is charged ONCE.
const marbleArea = (g: Geometry, c: Category, cfg: Cfg) =>
  cfg.marbleCategories.includes(c) ? dryRoomArea(g) : 0;
const tileArea = (g: Geometry, c: Category, cfg: Cfg) =>
  cfg.marbleCategories.includes(c) ? wetRoomArea(g) : floorArea(g);

const QUANTITY_BASIS: Record<
  RateItemType,
  (g: Geometry, category: Category, cfg: Cfg) => number
> = {
  masonry: (g) => netWallArea(g),
  plaster: (g) => plasterArea(g),
  shuttering: (g) => floorArea(g), // roof-slab centering
  steelFixing: (g, _c, cfg) => steelMaterialTons(g, cfg.materials), // labour on the same tonnage
  sanitary: (g) => bathroomCount(g),
  tileFixing: tileArea,
  marbleFixing: marbleArea,
  woodwork: (g) => openingArea(g),
  falseCeiling: (g) => dryRoomArea(g),
  foundation: (g) => floorArea(g),
  rccRoof: (g) => floorArea(g),
  electrical: (g) => floorArea(g),
  paint: (g) => plasterArea(g) + floorArea(g), // walls (both faces) + ceilings
  brick: (g, _c, cfg) => brickCount(g, cfg.materials) / 1000, // priced per 1,000
  cement: (g, _c, cfg) => cementBags(g, cfg.materials),
  sand: (g, _c, cfg) => sandCft(g, cfg.materials),
  steelMaterial: (g, _c, cfg) => steelMaterialTons(g, cfg.materials),
};

export function calculateBoq(
  geometry: Geometry,
  rateCard: RateCard,
  taxPercent: number = rateCard.taxPercent ?? 0,
  config: BoqConfig = {},
): BOQResult {
  const cfg: Cfg = {
    materials: config.materials ?? MATERIAL_ASSUMPTIONS,
    marbleCategories: config.marbleCategories ?? DEFAULT_MARBLE_CATEGORIES,
  };
  const lineItems: BOQLineItem[] = rateCard.items
    .map((rateItem) => {
      const quantity = QUANTITY_BASIS[rateItem.itemType](
        geometry,
        rateCard.category,
        cfg,
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
