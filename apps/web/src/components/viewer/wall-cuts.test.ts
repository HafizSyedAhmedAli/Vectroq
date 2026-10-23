import { describe, it, expect } from "vitest";
import type { Opening, Wall } from "@vectroq/shared-types";
import { planWalls } from "./wall-cuts";

const wall: Wall = {
  id: "w",
  startX: 0,
  startY: 0,
  endX: 10,
  endY: 0,
  length: 10,
  height: 10,
  thickness: 0.75,
};
const win: Opening = {
  id: "o",
  type: "window",
  width: 4,
  height: 4,
  x: 5,
  y: 0,
  angle: 0,
};
const door: Opening = {
  id: "d",
  type: "door",
  width: 3,
  height: 7,
  x: 5,
  y: 0,
  angle: 0,
};
const plan = (o: Opening, walls = [wall]) =>
  planWalls({ walls, rooms: [], openings: [o] });

describe("planWalls", () => {
  it("leaves a window hole with wall below the sill and above the head", () => {
    const [p] = plan(win);
    expect(p.cuts).toHaveLength(1);
    const full = p.pieces.filter((x) => x.y0 === 0 && x.y1 === 10);
    expect(full.map((x) => [x.u0, x.u1])).toEqual([
      [-0.375, 3],
      [7, 10.375],
    ]);
    expect(
      p.pieces.some(
        (x) => x.y0 === 0 && x.y1 === 3 && x.u0 === 3 && x.u1 === 7,
      ),
    ).toBe(true);
    expect(
      p.pieces.some(
        (x) => x.y0 === 7 && x.y1 === 10 && x.u0 === 3 && x.u1 === 7,
      ),
    ).toBe(true);
  });

  it("a door has no wall below it", () => {
    const [p] = plan(door);
    expect(p.pieces).toHaveLength(3); // left, right, above the door
    expect(p.pieces.every((x) => x.y1 > 0 && !(x.y0 === 0 && x.y1 < 10))).toBe(
      true,
    );
  });

  it("cuts the same hole in a duplicated wall", () => {
    const plans = plan(door, [wall, { ...wall, id: "w2" }]);
    expect(plans.every((p) => p.cuts.length === 1)).toBe(true);
  });

  it("ignores openings that are not on the wall", () => {
    const [p] = plan({ ...door, y: 5 });
    expect(p.cuts).toHaveLength(0);
    expect(p.pieces).toHaveLength(1);
  });

  it("tells which jamb a swung door hinges on and which way it opens", () => {
    const [p] = plan({
      ...door,
      hingeX: 3.5,
      hingeY: 0,
      openAngle: Math.PI / 2,
    });
    expect(p.cuts[0].hingeAtStart).toBe(true);
    expect(p.cuts[0].swingZ).toBe(-1);
  });
});
