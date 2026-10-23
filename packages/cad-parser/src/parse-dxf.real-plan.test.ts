import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDxfToGeometry } from "./parse-dxf";

describe("whole_house_simple_plan.dxf (LINE walls, mm units)", () => {
  const g = parseDxfToGeometry(
    readFileSync(
      join(__dirname, "../fixtures/whole_house_simple_plan.dxf"),
      "utf8",
    ),
  );

  it("converts mm to feet and finds all 7 rooms", () => {
    expect(g.rooms).toHaveLength(7);
    const total = g.rooms.reduce((s, r) => s + r.area, 0);
    expect(total).toBeCloseTo(12 * 10 * 10.7639, 0);
    expect(g.rooms.filter((r) => r.type === "bathroom")).toHaveLength(2);
    expect(g.rooms.find((r) => r.name === "Kitchen")?.area).toBeCloseTo(
      3.5 * 5.5 * 10.7639,
      0,
    );
    expect(g.rooms.every((r) => (r.shapes?.length ?? 0) > 0)).toBe(true);
  });

  it("reads 79.5 m of wall, thinner partitions inside", () => {
    expect(g.walls.reduce((s, w) => s + w.length, 0)).toBeCloseTo(
      79.5 * 3.28084,
      1,
    );
    expect(g.walls.filter((w) => w.thickness === 0.75)).toHaveLength(4);
  });

  it("finds 7 doors and 8 windows", () => {
    expect(g.openings.filter((o) => o.type === "door")).toHaveLength(7);
    expect(g.openings.filter((o) => o.type === "window")).toHaveLength(8);
  });

  it("uses the door arcs: the kitchen door runs the way its arc says", () => {
    const k = 0.00328084; // mm -> ft
    const door = g.openings.find(
      (o) =>
        o.type === "door" &&
        o.hingeX !== undefined &&
        Math.abs(o.hingeX - 8500 * k) < 0.05 &&
        Math.abs((o.hingeY ?? 0) - 2500 * k) < 0.05,
    );
    expect(door).toBeDefined();
    expect(door!.y).toBeCloseTo(2000 * k, 1);
    expect(door!.openAngle).toBeCloseTo(0, 1);
  });
});
