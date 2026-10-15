import { describe, it, expect } from "vitest";
import { dxfToGeometry, type RawEntity } from "./dxf-to-geometry";

const entities: RawEntity[] = [
  {
    type: "LWPOLYLINE",
    layer: "WALLS",
    vertices: [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 12 },
      { x: 0, y: 12 },
      { x: 0, y: 0 },
    ],
  },
  {
    type: "LWPOLYLINE",
    layer: "WALLS",
    vertices: [
      { x: 20, y: 0 },
      { x: 35, y: 0 },
      { x: 35, y: 18 },
      { x: 20, y: 18 },
      { x: 20, y: 0 },
    ],
  },
  {
    type: "LWPOLYLINE",
    layer: "WALLS",
    vertices: [
      { x: 35, y: 0 },
      { x: 41, y: 0 },
      { x: 41, y: 8 },
      { x: 35, y: 8 },
      { x: 35, y: 0 },
    ],
  },
  {
    type: "TEXT",
    layer: "TEXT",
    startPoint: { x: 5, y: 5 },
    text: "Kitchen 240 sq ft",
  },
  {
    type: "TEXT",
    layer: "TEXT",
    startPoint: { x: 23, y: 8 },
    text: "Living Room 270 sq ft",
  },
  {
    type: "TEXT",
    layer: "TEXT",
    startPoint: { x: 37, y: 4 },
    text: "Bathroom",
  },
  {
    type: "LINE",
    layer: "DOORS",
    vertices: [
      { x: 20, y: 4 },
      { x: 20, y: 7 },
    ],
  },
  {
    type: "LINE",
    layer: "WINDOWS",
    vertices: [
      { x: 0, y: 3 },
      { x: 0, y: 7 },
    ],
  },
];

describe("dxfToGeometry", () => {
  const geometry = dxfToGeometry({ entities });

  it("extracts one room per closed WALLS polyline, with computed area (not the drafted label)", () => {
    expect(geometry.rooms).toHaveLength(3);
    const kitchen = geometry.rooms.find((r) => r.name === "Kitchen");
    expect(kitchen?.area).toBeCloseTo(240);
    expect(kitchen?.type).toBe("kitchen");
  });

  it("detects bathroom type from the label even without an area suffix", () => {
    const bathroom = geometry.rooms.find((r) => r.name === "Bathroom");
    expect(bathroom?.type).toBe("bathroom");
    expect(bathroom?.area).toBeCloseTo(48);
  });

  it("falls back to general for an unmatched label", () => {
    const livingRoom = geometry.rooms.find((r) => r.name === "Living Room");
    expect(livingRoom?.type).toBe("general");
    expect(livingRoom?.area).toBeCloseTo(270);
  });

  it("turns each polyline edge into a wall segment", () => {
    // 3 rooms x 4 edges each (closing vertex doesn't create a 5th)
    expect(geometry.walls).toHaveLength(12);
    expect(geometry.walls[0].length).toBeCloseTo(20);
    expect(geometry.walls[0].height).toBe(10);
    expect(geometry.walls[0].thickness).toBe(0.75);
  });

  it("extracts doors and windows from their layers, sized from line length", () => {
    expect(geometry.openings).toHaveLength(2);
    const door = geometry.openings.find((o) => o.type === "door");
    const windowOpening = geometry.openings.find((o) => o.type === "window");
    expect(door?.width).toBeCloseTo(3);
    expect(door?.height).toBe(7);
    expect(windowOpening?.width).toBeCloseTo(4);
    expect(windowOpening?.height).toBe(4);
  });

  it("ignores LINE entities on layers that aren't DOORS or WINDOWS", () => {
    const withNoise = dxfToGeometry({
      entities: [
        ...entities,
        {
          type: "LINE",
          layer: "DIMENSIONS",
          vertices: [
            { x: 0, y: 0 },
            { x: 5, y: 5 },
          ],
        },
      ],
    });
    expect(withNoise.openings).toHaveLength(2);
  });
});
