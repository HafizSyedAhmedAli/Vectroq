import { describe, it, expect } from "vitest";
import type { Wall } from "@vectroq/shared-types";
import { snapToWall } from "./place-openings";

const wall = (
  id: string,
  sx: number,
  sy: number,
  ex: number,
  ey: number,
): Wall => ({
  id,
  startX: sx,
  startY: sy,
  endX: ex,
  endY: ey,
  length: Math.hypot(ex - sx, ey - sy),
  height: 10,
  thickness: 0.75,
});
const bottom = wall("w", 0, 0, 10, 0);

describe("snapToWall", () => {
  it("returns nothing when there are no walls", () => {
    expect(snapToWall({ x: 0, y: 0 }, { x: 1, y: 0 }, [])).toEqual({});
  });

  it("centres a line lying on the wall at its midpoint", () => {
    const r = snapToWall({ x: 2, y: 0 }, { x: 6, y: 0 }, [bottom]);
    expect(r.x).toBeCloseTo(4);
    expect(r.y).toBeCloseTo(0);
    expect(r.angle).toBeCloseTo(0);
    expect(r.hingeX).toBeUndefined();
  });

  it("uses the angle of a vertical wall", () => {
    const r = snapToWall({ x: 0, y: 2 }, { x: 0, y: 6 }, [
      wall("v", 0, 0, 0, 10),
    ]);
    expect(r.y).toBeCloseTo(4);
    expect(r.angle).toBeCloseTo(Math.PI / 2);
  });

  it("treats a leaf with its hinge on the wall as a swung door", () => {
    const r = snapToWall({ x: 5, y: 0 }, { x: 5, y: 3 }, [bottom]);
    expect(r.hingeX).toBeCloseTo(5);
    expect(r.hingeY).toBeCloseTo(0);
    expect(r.openAngle).toBeCloseTo(Math.PI / 2);
    expect(r.x).toBeCloseTo(6.5); // half a width along the wall
    expect(r.y).toBeCloseTo(0);
  });

  it("accepts the leaf drawn from either end", () => {
    const r = snapToWall({ x: 5, y: 3 }, { x: 5, y: 0 }, [bottom]);
    expect(r.hingeX).toBeCloseTo(5);
    expect(r.x).toBeCloseTo(6.5);
  });

  it("runs the door the way its arc says when the span is clear", () => {
    const r = snapToWall({ x: 5, y: 0 }, { x: 5, y: 3 }, [bottom], Math.PI);
    expect(r.x).toBeCloseTo(3.5);
  });

  it("keeps the default direction when a crossing wall ends inside that span", () => {
    const crossing = wall("c", 3.5, 0, 3.5, 5);
    const r = snapToWall(
      { x: 5, y: 0 },
      { x: 5, y: 3 },
      [bottom, crossing],
      Math.PI,
    );
    expect(r.x).toBeCloseTo(6.5);
  });
});
