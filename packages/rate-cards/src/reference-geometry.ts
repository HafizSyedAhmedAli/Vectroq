// packages/rate-cards/src/reference-geometry.ts
import type { EngagementModel, Geometry } from "@tmcc/shared-types";

// Stand-in for real CAD output, ONLY for the instant ballpark on the intake
// form: four exterior walls, interior partitions ~90% of the perimeter,
// about one door per 150 sqft and one window per 120 sqft.
export const REFERENCE_GEOMETRY: Record<EngagementModel, Geometry> = {
  1: houseArchetype(1200),
  2: houseArchetype(1800),
  3: houseArchetype(2400),
};

function houseArchetype(builtUpSqft: number): Geometry {
  const side = Math.sqrt(builtUpSqft);
  const wall = (id: string, length: number, thickness: number) => ({
    id,
    startX: 0,
    startY: 0,
    endX: length,
    endY: 0,
    length,
    height: 10,
    thickness,
  });
  const doors = Math.round(builtUpSqft / 150);
  const windows = Math.round(builtUpSqft / 120);
  return {
    walls: [
      wall("e1", side, 0.75),
      wall("e2", side, 0.75),
      wall("e3", side, 0.75),
      wall("e4", side, 0.75),
      wall("p1", side * 4 * 0.9, 0.375),
    ],
    rooms: [
      {
        id: "r1",
        name: "Living/General",
        area: builtUpSqft * 0.7,
        type: "general",
      },
      { id: "r2", name: "Kitchen", area: builtUpSqft * 0.1, type: "kitchen" },
      {
        id: "r3",
        name: "Bathroom 1",
        area: builtUpSqft * 0.05,
        type: "bathroom",
      },
      {
        id: "r4",
        name: "Bathroom 2",
        area: builtUpSqft * 0.05,
        type: "bathroom",
      },
    ],
    openings: [
      ...Array.from({ length: doors }, (_, i) => ({
        id: `d${i}`,
        type: "door" as const,
        width: 3,
        height: 7,
      })),
      ...Array.from({ length: windows }, (_, i) => ({
        id: `w${i}`,
        type: "window" as const,
        width: 4,
        height: 4,
      })),
    ],
  };
}
