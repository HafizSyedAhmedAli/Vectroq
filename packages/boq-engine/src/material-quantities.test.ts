import { describe, it, expect } from "vitest";
import type { Geometry } from "@tmcc/shared-types";
import {
  brickCount,
  cementBags,
  sandCft,
  steelMaterialTons,
} from "./material-quantities";

const house = (thickness: number): Geometry => ({
  walls: [
    {
      id: "w1",
      startX: 0,
      startY: 0,
      endX: 20,
      endY: 0,
      length: 20,
      height: 10,
      thickness,
    },
  ],
  rooms: [{ id: "r1", name: "Kitchen", area: 47, type: "kitchen" }],
  openings: [],
});

describe("material quantities", () => {
  it("counts bricks from wall face area (9in wall)", () => {
    expect(brickCount(house(0.75))).toBe(2700); // 200 sqft * 13.5
  });

  it("halves bricks for a 4.5in wall", () => {
    expect(brickCount(house(0.375))).toBe(1350);
  });

  it("rounds cement up to whole bags", () => {
    // 2.7*5 + 400*0.04 = 29.5
    expect(cementBags(house(0.75))).toBe(30);
  });

  it("computes sand in cft", () => {
    // 2.7*30 + 400*0.12 = 129
    expect(sandCft(house(0.75))).toBe(129);
  });

  it("computes steel material tons from floor area", () => {
    expect(steelMaterialTons(house(0.75))).toBeCloseTo(0.188, 3);
  });

  it("returns zero for empty geometry", () => {
    const empty: Geometry = { walls: [], rooms: [], openings: [] };
    expect(brickCount(empty)).toBe(0);
    expect(cementBags(empty)).toBe(0);
  });
});
