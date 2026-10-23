import { describe, it, expect } from "vitest";
import type { Opening, Room, RoomType } from "@vectroq/shared-types";
import {
  doorClearance,
  footprintOf,
  gapToRect,
  layoutFurniture,
  type Placed,
} from "./furniture-layout";

function room(
  name: string,
  type: RoomType,
  x1: number,
  y1: number,
  x0 = 0,
  y0 = 0,
): Room {
  return {
    id: name,
    name,
    type,
    area: (x1 - x0) * (y1 - y0),
    shapes: [
      [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 },
        { x: x0, y: y1 },
      ],
    ],
  };
}
const rect = (p: Placed) => footprintOf(p.x, p.y, p.facing, p.w, p.d);
const kinds = (ps: Placed[]) => ps.map((p) => p.kind);

describe("layoutFurniture", () => {
  it("furnishes a bedroom with a bed and a wardrobe, inside the room", () => {
    const ps = layoutFurniture(room("Bedroom 1", "general", 12, 12), []);
    expect(kinds(ps)).toEqual(expect.arrayContaining(["bed", "wardrobe"]));
    for (const p of ps) {
      const r = rect(p);
      expect(r.x0).toBeGreaterThanOrEqual(0);
      expect(r.y0).toBeGreaterThanOrEqual(0);
      expect(r.x1).toBeLessThanOrEqual(12);
      expect(r.y1).toBeLessThanOrEqual(12);
    }
  });

  it("never overlaps two pieces", () => {
    const ps = layoutFurniture(room("Living Room", "general", 14, 12), []);
    const rs = ps.map(rect);
    for (let i = 0; i < rs.length; i++)
      for (let j = i + 1; j < rs.length; j++) {
        const a = rs[i];
        const b = rs[j];
        const overlap =
          a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
        expect(overlap).toBe(false);
      }
  });

  it("keeps clear of a door swing", () => {
    const door: Opening = {
      id: "d",
      type: "door",
      width: 3,
      height: 7,
      x: 0,
      y: 6,
      angle: Math.PI / 2,
    };
    const ps = layoutFurniture(room("Bedroom", "general", 12, 12), [door]);
    expect(ps.length).toBeGreaterThan(0);
    for (const p of ps)
      expect(gapToRect(rect(p), { x: 0, y: 6 })).toBeGreaterThanOrEqual(
        doorClearance(door) - 1e-6,
      );
  });

  it("places a toilet and basin in a bathroom", () => {
    const ps = layoutFurniture(room("Bath", "bathroom", 6, 8), []);
    expect(kinds(ps)).toEqual(expect.arrayContaining(["toilet", "basin"]));
  });

  it("places a counter in a kitchen", () => {
    const ps = layoutFurniture(room("Kitchen", "kitchen", 10, 8), []);
    expect(kinds(ps)).toContain("counter");
  });

  it("places sofa, coffee table and TV unit in a living room", () => {
    const ps = layoutFurniture(room("Living Room", "general", 14, 12), []);
    expect(kinds(ps)).toEqual(
      expect.arrayContaining(["sofa", "coffeeTable", "tvUnit"]),
    );
  });

  it("places a dining table with four chairs", () => {
    const ps = layoutFurniture(room("Dining", "general", 12, 10), []);
    expect(kinds(ps).filter((k) => k === "chair")).toHaveLength(4);
    expect(kinds(ps)).toContain("diningTable");
  });

  it("leaves unnamed rooms, tiny rooms and rooms without shapes empty", () => {
    expect(layoutFurniture(room("Room 3", "general", 12, 12), [])).toEqual([]);
    expect(layoutFurniture(room("Bedroom", "general", 4, 4), [])).toEqual([]);
    expect(
      layoutFurniture(
        { ...room("Bedroom", "general", 12, 12), shapes: undefined },
        [],
      ),
    ).toEqual([]);
  });

  it("furnishes a study with a desk, a chair and a bookshelf", () => {
    const ps = layoutFurniture(room("Study", "general", 14, 12), []);
    expect(kinds(ps)).toEqual(
      expect.arrayContaining(["desk", "chair", "bookshelf"]),
    );
  });

  it("still treats Bedroom Study as a study", () => {
    const ps = layoutFurniture(room("Bedroom Study", "general", 14, 12), []);
    expect(kinds(ps)).toContain("desk");
  });
});
