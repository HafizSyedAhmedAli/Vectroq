import { describe, it, expect } from "vitest";
import { REFERENCE_GEOMETRY } from "./reference-geometry";

const SIZES = { 1: 1200, 2: 1800, 3: 2400 } as const;

describe("REFERENCE_GEOMETRY", () => {
  it.each([1, 2, 3] as const)("model %i is a coherent small house", (m) => {
    const g = REFERENCE_GEOMETRY[m];
    const built = SIZES[m];
    expect(g.rooms.reduce((s, r) => s + r.area, 0)).toBeCloseTo(built * 0.9);
    expect(g.rooms.filter((r) => r.type === "bathroom")).toHaveLength(2);
    expect(g.rooms.filter((r) => r.type === "kitchen")).toHaveLength(1);
    expect(g.walls).toHaveLength(5);
    expect(g.walls.slice(0, 4).every((w) => w.thickness === 0.75)).toBe(true);
    expect(g.walls[4].thickness).toBe(0.375);
    expect(g.walls.every((w) => w.height === 10)).toBe(true);
    expect(g.walls[4].length).toBeCloseTo(Math.sqrt(built) * 4 * 0.9);
  });

  it("scales openings with the built-up area", () => {
    const count = (m: 1 | 2 | 3, t: "door" | "window") =>
      REFERENCE_GEOMETRY[m].openings.filter((o) => o.type === t).length;
    expect([count(1, "door"), count(2, "door"), count(3, "door")]).toEqual([
      8, 12, 16,
    ]);
    expect([
      count(1, "window"),
      count(2, "window"),
      count(3, "window"),
    ]).toEqual([10, 15, 20]);
  });

  it("uses standard door and window sizes", () => {
    const o = REFERENCE_GEOMETRY[1].openings;
    expect(o.find((x) => x.type === "door")).toMatchObject({
      width: 3,
      height: 7,
    });
    expect(o.find((x) => x.type === "window")).toMatchObject({
      width: 4,
      height: 4,
    });
  });

  it("gives every opening a unique id", () => {
    for (const m of [1, 2, 3] as const) {
      const ids = REFERENCE_GEOMETRY[m].openings.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
