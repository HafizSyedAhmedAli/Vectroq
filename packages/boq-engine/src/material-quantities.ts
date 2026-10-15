import type { Geometry } from "@tmcc/shared-types";

export const MATERIAL_ASSUMPTIONS = {
  referenceThicknessFt: 0.75, // 9 in wall
  bricksPerSqftFaceAtReference: 13.5,
  cementBagsPer1000Bricks: 5,
  sandCftPer1000Bricks: 30,
  plasterCementBagsPerSqft: 0.04,
  plasterSandCftPerSqft: 0.12,
  steelKgPerSqft: 4, // rule of thumb: kg of reinforcement per sqft of covered area
} as const;

const A = MATERIAL_ASSUMPTIONS;

/** Gross wall face area (no openings deducted). */
export function wallFaceArea(g: Geometry): number {
  return g.walls.reduce((s, w) => s + w.length * w.height, 0);
}

/** Door + window area. */
export function openingArea(g: Geometry): number {
  return g.openings.reduce((s, o) => s + o.width * o.height, 0);
}

/** Wall face area with door/window openings deducted (never below zero). */
export function netWallArea(g: Geometry): number {
  return Math.max(0, wallFaceArea(g) - openingArea(g));
}

export function floorArea(g: Geometry): number {
  return g.rooms.reduce((s, r) => s + r.area, 0);
}

/** Kitchens and bathrooms (always tiled, never marble/false ceiling). */
export function wetRoomArea(g: Geometry): number {
  return g.rooms
    .filter((r) => r.type === "bathroom" || r.type === "kitchen")
    .reduce((s, r) => s + r.area, 0);
}

export function dryRoomArea(g: Geometry): number {
  return floorArea(g) - wetRoomArea(g);
}

// Bricks scale with wall thickness (4.5 in wall = half the bricks); openings
// are deducted in proportion.
export function brickCount(g: Geometry): number {
  const gross = wallFaceArea(g);
  if (gross === 0) return 0;
  const bricks = g.walls.reduce(
    (s, w) =>
      s +
      w.length *
        w.height *
        A.bricksPerSqftFaceAtReference *
        (w.thickness / A.referenceThicknessFt),
    0,
  );
  return Math.ceil(bricks * (netWallArea(g) / gross));
}

// Plaster covers both faces of every wall.
export function plasterArea(g: Geometry): number {
  return netWallArea(g) * 2;
}

export function cementBags(g: Geometry): number {
  const raw =
    (brickCount(g) / 1000) * A.cementBagsPer1000Bricks +
    plasterArea(g) * A.plasterCementBagsPerSqft;
  return Math.ceil(raw); // whole bags only
}

export function sandCft(g: Geometry): number {
  const raw =
    (brickCount(g) / 1000) * A.sandCftPer1000Bricks +
    plasterArea(g) * A.plasterSandCftPerSqft;
  return Math.round(raw * 100) / 100;
}

export function steelMaterialTons(g: Geometry): number {
  return (floorArea(g) * A.steelKgPerSqft) / 1000;
}
