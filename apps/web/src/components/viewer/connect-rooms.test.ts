import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import type { Geometry, Opening, Room } from "@vectroq/shared-types";
import { parseDxfToGeometry } from "@vectroq/cad-parser";
import { addConnectingOpenings } from "./connect-rooms";

function room(name: string, x0: number, x1: number, y0 = 0, y1 = 10): Room {
  return {
    id: name,
    name,
    type: "general",
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
const geo = (rooms: Room[], openings: Opening[] = []): Geometry => ({
  walls: [],
  rooms,
  openings,
});
const doorAt = (x: number, y: number): Opening => ({
  id: "d",
  type: "door",
  width: 3,
  height: 7,
  x,
  y,
  angle: Math.PI / 2,
});

describe("addConnectingOpenings", () => {
  it("adds an archway between two rooms nothing connects", () => {
    const out = addConnectingOpenings(
      geo([room("A", 0, 10), room("B", 10, 20)]),
    );
    expect(out.openings).toHaveLength(1);
    expect(out.openings[0]).toMatchObject({ archway: true, x: 10, y: 5 });
  });

  it("adds nothing when a door already joins them", () => {
    const g = geo([room("A", 0, 10), room("B", 10, 20)], [doorAt(10, 5)]);
    expect(addConnectingOpenings(g).openings).toHaveLength(1);
  });

  it("links a chain of three rooms with two archways", () => {
    const out = addConnectingOpenings(
      geo([room("A", 0, 10), room("B", 10, 20), room("C", 20, 30)]),
    );
    expect(out.openings).toHaveLength(2);
  });

  it("does not link rooms that only touch at a corner", () => {
    const g = geo([room("A", 0, 10, 0, 10), room("B", 10, 20, 10, 20)]);
    expect(addConnectingOpenings(g).openings).toHaveLength(0);
  });

  it("joins the two halves of the sample plan through Living Room and Dining", () => {
    const g = parseDxfToGeometry(
      readFileSync(
        join(
          __dirname,
          "../../../../../packages/cad-parser/fixtures/whole_house_simple_plan.dxf",
        ),
        "utf8",
      ),
    );
    const out = addConnectingOpenings(g);
    const added = out.openings.filter((o) => o.archway);
    expect(added).toHaveLength(1);
    expect(added[0].y).toBeCloseTo(5.5 * 3.28084, 0); // the living / dining wall
  });

  it("adds no archway when the DXF already has the connecting door", () => {
    const dxf = readFileSync(
      join(
        __dirname,
        "../../../../../packages/cad-parser/fixtures/whole_house_connected.dxf",
      ),
      "utf8",
    );
    const g = parseDxfToGeometry(dxf); // use the same helper your sample-DXF test uses
    expect(
      addConnectingOpenings(g).openings.filter((o) => o.archway),
    ).toHaveLength(0);
  });
});
