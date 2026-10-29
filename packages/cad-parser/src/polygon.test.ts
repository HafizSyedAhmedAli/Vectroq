import { describe, it, expect } from "vitest";
import { distance, pointInPolygon, polygonArea } from "./polygon";

const rect = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 3 },
  { x: 0, y: 3 },
];
const L = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 4 },
  { x: 4, y: 4 },
  { x: 4, y: 10 },
  { x: 0, y: 10 },
];

describe("polygonArea", () => {
  it("measures a rectangle and a triangle", () => {
    expect(polygonArea(rect)).toBe(12);
    expect(
      polygonArea([
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 0, y: 4 },
      ]),
    ).toBe(12);
  });
  it("is the same for either winding direction", () => {
    expect(polygonArea([...rect].reverse())).toBe(12);
  });
  it("handles an L shape", () => expect(polygonArea(L)).toBe(10 * 4 + 4 * 6));
  it("is zero for empty or collinear input", () => {
    expect(polygonArea([])).toBe(0);
    expect(
      polygonArea([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ]),
    ).toBe(0);
  });
});

describe("distance", () => {
  it("is the straight-line distance", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(distance({ x: 2, y: 2 }, { x: 2, y: 2 })).toBe(0);
  });
});

describe("pointInPolygon", () => {
  it("separates inside from outside", () => {
    expect(pointInPolygon({ x: 2, y: 1 }, rect)).toBe(true);
    expect(pointInPolygon({ x: 5, y: 1 }, rect)).toBe(false);
    expect(pointInPolygon({ x: -1, y: 1 }, rect)).toBe(false);
  });
  it("respects the notch of a concave shape", () => {
    expect(pointInPolygon({ x: 2, y: 8 }, L)).toBe(true);
    expect(pointInPolygon({ x: 8, y: 2 }, L)).toBe(true);
    expect(pointInPolygon({ x: 8, y: 8 }, L)).toBe(false);
  });
});
