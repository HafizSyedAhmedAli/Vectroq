import { describe, it, expect } from "vitest";
import type { Geometry, Opening, Room, RoomType } from "@vectroq/shared-types";
import {
  footprintOf,
  furnitureRects,
  gapToRect,
  layoutFurniture,
  roomBounds,
  roomIsRectangular,
  type Placed,
} from "./furniture-layout";

const box = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];
function room(name: string, type: RoomType, w: number, h: number, ox = 0, oy = 0): Room {
  return { id: name, name, type, area: w * h, shapes: [box(ox, oy, ox + w, oy + h)] };
}
const rect = (p: Placed) => footprintOf(p.x, p.y, p.facing, p.w, p.d);
const kinds = (ps: Placed[]) => ps.map((p) => p.kind);
const inside = (r: ReturnType<typeof rect>, w: number, h: number) =>
  r.x0 >= 0 && r.y0 >= 0 && r.x1 <= w && r.y1 <= h;

describe("roomBounds / roomIsRectangular", () => {
  it("computes bounds across several shapes", () => {
    const r: Room = {
      ...room("X", "general", 4, 4),
      shapes: [box(0, 0, 4, 4), box(4, 1, 6, 3)],
    };
    expect(roomBounds(r)).toEqual({ minX: 0, maxX: 6, minY: 0, maxY: 4 });
  });
  it("returns null without shapes", () => {
    expect(roomBounds({ ...room("X", "general", 4, 4), shapes: undefined })).toBeNull();
    expect(roomBounds({ ...room("X", "general", 4, 4), shapes: [] })).toBeNull();
  });
  it("detects rectangles, L shapes and empty rooms", () => {
    expect(roomIsRectangular(room("R", "general", 10, 8))).toBe(true);
    const L: Room = {
      ...room("L", "general", 10, 10),
      shapes: [[
        { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 },
        { x: 4, y: 4 }, { x: 4, y: 10 }, { x: 0, y: 10 },
      ]],
    };
    expect(roomIsRectangular(L)).toBe(false);
    expect(roomIsRectangular({ ...L, shapes: undefined })).toBe(false);
    expect(roomIsRectangular({ ...L, shapes: [box(0, 0, 0, 0)] })).toBe(false);
  });
});

describe("footprintOf / gapToRect", () => {
  it("swaps width and depth depending on facing axis", () => {
    expect(footprintOf(5, 5, [0, 1], 4, 2)).toEqual({ x0: 3, x1: 7, y0: 4, y1: 6 });
    expect(footprintOf(5, 5, [1, 0], 4, 2)).toEqual({ x0: 4, x1: 6, y0: 3, y1: 7 });
  });
  it("measures straight and diagonal gaps, 0 inside", () => {
    const r = { x0: 0, x1: 2, y0: 0, y1: 2 };
    expect(gapToRect(r, { x: 1, y: 1 })).toBe(0);
    expect(gapToRect(r, { x: 5, y: 1 })).toBe(3);
    expect(gapToRect(r, { x: 5, y: 6 })).toBe(5);
  });
});

describe("layoutFurniture variants", () => {
  it("handles a tall (portrait) bedroom and keeps items inside", () => {
    const ps = layoutFurniture(room("Master Bedroom", "general", 10, 16), []);
    expect(kinds(ps)).toEqual(expect.arrayContaining(["bed", "wardrobe"]));
    ps.forEach((p) => expect(inside(rect(p), 10, 16)).toBe(true));
  });
  it("uses a smaller bed in small bedrooms", () => {
    const small = layoutFurniture(room("Kids Room", "general", 9, 10), []);
    const bed = small.find((p) => p.kind === "bed");
    expect(bed).toBeDefined();
    expect(Math.min(bed!.w, bed!.d)).toBe(3.5);
  });
  it("uses a larger bed in big bedrooms", () => {
    const bed = layoutFurniture(room("Guest", "general", 14, 14), []).find(
      (p) => p.kind === "bed",
    );
    expect(Math.min(bed!.w, bed!.d)).toBe(5.5);
  });
  it("places a larger sofa in big living rooms and faces the TV opposite", () => {
    const ps = layoutFurniture(room("Lounge", "general", 16, 14), []);
    const sofa = ps.find((p) => p.kind === "sofa")!;
    const tv = ps.find((p) => p.kind === "tvUnit");
    expect(sofa.w).toBe(6.5);
    expect(tv).toBeDefined();
    expect(tv!.facing[0] * sofa.facing[0] + tv!.facing[1] * sofa.facing[1]).toBeLessThan(0);
  });
  it("lays out a portrait dining room across the other axis", () => {
    const ps = layoutFurniture(room("Dining", "general", 9, 13), []);
    expect(kinds(ps).filter((k) => k === "chair")).toHaveLength(4);
    const t = ps.find((p) => p.kind === "diningTable")!;
    expect(t.facing).toEqual([1, 0]);
  });
  it("falls back to a bare table when the full set does not fit", () => {
    const ps = layoutFurniture(room("Dining", "general", 6.5, 4.2), []);
    expect(kinds(ps).filter((k) => k === "chair")).toHaveLength(0);
  });
  it("uses the label position when the bounding-box centre is outside an L-shaped dining room", () => {
    const L: Room = {
      id: "d", name: "Dining", type: "general", area: 100,
      labelX: 2, labelY: 2,
      shapes: [[
        { x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 3 },
        { x: 3, y: 3 }, { x: 3, y: 12 }, { x: 0, y: 12 },
      ]],
    };
    expect(() => layoutFurniture(L, [])).not.toThrow();
  });
  it("avoids windows for the wardrobe by default but a sparse layout still works", () => {
    const win: Opening = { id: "w", type: "window", width: 4, height: 4, x: 6, y: 0, angle: 0 };
    const ps = layoutFurniture(room("Bedroom", "general", 12, 12), [win]);
    expect(kinds(ps)).toContain("bed");
  });
  it("ignores openings without coordinates", () => {
    const d: Opening = { id: "d", type: "door", width: 3, height: 7 };
    const ps = layoutFurniture(room("Bedroom", "general", 12, 12), [d]);
    expect(ps.length).toBeGreaterThan(0);
  });
  it("shrinks the kitchen counter until it fits", () => {
    const ps = layoutFurniture(room("Kitchen", "kitchen", 7, 6), []);
    const c = ps.find((p) => p.kind === "counter");
    expect(c).toBeDefined();
    expect(Math.max(c!.w, c!.d)).toBeLessThanOrEqual(8);
  });
  it("matches study keywords", () => {
    for (const n of ["Office", "Library", "Workspace"])
      expect(kinds(layoutFurniture(room(n, "general", 14, 12), []))).toContain("desk");
  });
  it("matches living keywords", () => {
    for (const n of ["Drawing Room", "TV Lounge", "Family Room"])
      expect(kinds(layoutFurniture(room(n, "general", 14, 12), []))).toContain("sofa");
  });
});

describe("furnitureRects", () => {
  it("returns a footprint per placed piece across all rooms", () => {
    const g: Geometry = {
      walls: [],
      openings: [],
      rooms: [room("Bedroom", "general", 12, 12), room("Bath", "bathroom", 6, 8, 20, 0)],
    };
    const expected = g.rooms.flatMap((r) => layoutFurniture(r, g.openings)).length;
    const rects = furnitureRects(g);
    expect(rects).toHaveLength(expected);
    expect(rects.length).toBeGreaterThan(2);
    rects.forEach((r) => {
      expect(r.x1).toBeGreaterThan(r.x0);
      expect(r.y1).toBeGreaterThan(r.y0);
    });
  });
  it("is empty for no rooms", () => {
    expect(furnitureRects({ walls: [], rooms: [], openings: [] })).toEqual([]);
  });
});
