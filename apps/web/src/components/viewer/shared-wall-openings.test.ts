// @vitest-environment node
// Phase 2 Stage 2: when two rooms' shared wall is merged into one wall, openings
// on it must still render identically. This runs the real parser and the real
// viewer wall planner (planWalls, which HouseViewer draws from) and compares the
// physical result: where the hole is, which jamb the hinge is on, and which way
// the door leaf swings, with each opening described in world (CAD) coordinates,
// so it does not matter which direction a wall's own axis points.
import { describe, expect, it } from "vitest";
import type { Geometry, Opening, Wall } from "@vectroq/shared-types";
import { dxfToGeometry } from "@vectroq/cad-parser";
import { planWalls } from "./wall-cuts";

type P = { x: number; y: number };
const rect = (x0: number, y0: number, x1: number, y1: number): P[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
  { x: x0, y: y0 },
];
const line = (layer: string, a: number[], b: number[]) => ({
  type: "LINE",
  layer,
  vertices: [
    { x: a[0], y: a[1] },
    { x: b[0], y: b[1] },
  ],
});
const wallsLayer = (v: P[]) => ({
  type: "LWPOLYLINE",
  layer: "WALLS",
  vertices: v,
});

/** The per-edge walls the parser produced before shared walls were merged. */
const perEdgeWalls = (polys: P[][]): Wall[] =>
  polys.flatMap((v, pi) =>
    v.flatMap((a, i) => {
      const b = v[(i + 1) % v.length];
      if (a.x === b.x && a.y === b.y) return [];
      return [
        {
          id: `wall-${pi}-${i}`,
          startX: a.x,
          startY: a.y,
          endX: b.x,
          endY: b.y,
          length: Math.hypot(b.x - a.x, b.y - a.y),
          height: 10,
          thickness: 0.75,
        },
      ];
    }),
  );

const r9 = (n: number) => Math.round(n * 1e9) / 1e9 + 0; // + 0 turns -0 into 0

/** What a cut looks like in world coordinates. */
function physical(wall: Wall, cut: ReturnType<typeof planWalls>[0]["cuts"][0]) {
  const len = Math.hypot(wall.endX - wall.startX, wall.endY - wall.startY);
  const ux = (wall.endX - wall.startX) / len;
  const uy = (wall.endY - wall.startY) / len;
  const at = (u: number) => [
    r9(wall.startX + ux * u),
    r9(wall.startY + uy * u),
  ];
  const out: Record<string, unknown> = {
    from: [at(cut.u0), at(cut.u1)]
      .sort((p, q) => p[0] - q[0] || p[1] - q[1])
      .flat(),
  };
  if (cut.hingeAtStart !== undefined && cut.swingZ !== undefined) {
    out.hinge = at(cut.hingeAtStart ? cut.u0 : cut.u1);
    // HouseViewer swings the leaf toward the wall group's local +z, which is CAD (uy, -ux)
    out.leafSide = [r9(cut.swingZ * uy), r9(cut.swingZ * -ux)];
  }
  return out;
}

/** world-space description of every cut for one opening, one entry per host wall */
function describeOpening(g: Geometry, id: string) {
  return planWalls(g).flatMap((p) =>
    p.cuts.filter((c) => c.openingId === id).map((c) => physical(p.wall, c)),
  );
}

const r1 = rect(0, 0, 10, 8);
const r2 = rect(10, 0, 20, 12); // taller: its wall continues past the shared run
const openingLines = [
  line("DOORS", [10, 0.2], [10, 3.2]), // door-0: drawn along the shared wall
  line("DOORS", [10, 3], [13, 3]), // door-1: hinge-style leaf, shared run, leaf into room 2
  line("DOORS", [13, 9], [10, 9]), // door-2: hinge-style leaf where only room 2's wall is
  line("DOORS", [0, 2], [0, 5]), // door-3: unshared wall
  line("WINDOWS", [10, 9], [10, 11]), // window-0: only room 2's wall is there
];
const ids = ["door-0", "door-1", "door-2", "door-3", "window-0"];

describe("openings on a merged shared wall render as before", () => {
  for (const [name, polys] of [
    ["room 1 first", [r1, r2]],
    ["room 2 first", [r2, r1]],
  ] as const)
    it(`${name}: same hole, hinge jamb and swing side as the unmerged walls; one host wall`, () => {
      const g = dxfToGeometry({
        entities: [...polys.map(wallsLayer), ...openingLines],
      } as never);
      expect(g.walls).toHaveLength(7); // merged: the shared wall exists once
      const before: Geometry = {
        ...g,
        walls: perEdgeWalls([...polys]), // the pre-merge walls, shared run drawn twice
      };
      for (const id of ids) {
        const after = describeOpening(g, id);
        const old = describeOpening(before, id);
        expect(after, `${id} after`).toHaveLength(1);
        expect(old.length).toBeGreaterThanOrEqual(1);
        // The old copy on the wall that fully contains the hole is the new hole,
        // and no old copy cut outside it. (A copy on a shorter wall is clipped at
        // that wall's end, so it can be smaller; it drew its own leaf, a double
        // leaf that merging removes.)
        expect(old, id).toContainEqual(after[0]);
        const [ax, ay, bx, by] = after[0].from as number[];
        for (const o of old) {
          const [px, py, qx, qy] = o.from as number[];
          expect(Math.min(px, qx)).toBeGreaterThanOrEqual(Math.min(ax, bx));
          expect(Math.max(px, qx)).toBeLessThanOrEqual(Math.max(ax, bx));
          expect(Math.min(py, qy)).toBeGreaterThanOrEqual(Math.min(ay, by));
          expect(Math.max(py, qy)).toBeLessThanOrEqual(Math.max(ay, by));
        }
      }
      // Literal pre-Stage-2 results, captured from the parser before shared walls
      // were merged. (A hinge-style door with no swing arc is centred in the
      // direction of the wall it snaps to, so door-1's side follows the first
      // polygon's wall. That order dependence is old behaviour, unchanged here.)
      const door1 = name === "room 1 first" ? [10, 3, 10, 6] : [10, 0, 10, 3];
      const hinge1 = [10, 3];
      expect(describeOpening(g, "door-1")[0]).toMatchObject({
        from: door1,
        hinge: hinge1,
      });
      expect(describeOpening(g, "door-2")[0]).toMatchObject({
        from: [10, 6, 10, 9],
        hinge: [10, 9],
      });
      expect(describeOpening(g, "door-0")[0]).toMatchObject({
        from: [10, 0.2, 10, 3.2],
      });
      // swing facts, from the drawing: the leaf lines point toward +x
      for (const id of ["door-1", "door-2"]) {
        const [d] = describeOpening(g, id) as { leafSide: number[] }[];
        expect(d.leafSide).toEqual([1, 0]);
      }
    });

  it("a wall's direction and the opening angle's direction do not matter: reversing the wall and flipping the angle by pi gives the same world result", () => {
    const g = dxfToGeometry({
      entities: [...[r1, r2].map(wallsLayer), ...openingLines],
    } as never);
    const flipped: Geometry = {
      ...g,
      walls: g.walls.map((w) => ({
        ...w,
        startX: w.endX,
        startY: w.endY,
        endX: w.startX,
        endY: w.startY,
      })),
      openings: g.openings.map((o): Opening => ({
        ...o,
        angle: (o.angle ?? 0) + Math.PI,
      })),
    };
    for (const id of ids)
      expect(describeOpening(flipped, id), id).toEqual(describeOpening(g, id));
  });

  it("doors and windows drawn along the wall land at the same world position whichever polygon is first", () => {
    const pos = (polys: P[][]) => {
      const g = dxfToGeometry({
        entities: [...polys.map(wallsLayer), ...openingLines],
      } as never);
      return ["door-0", "window-0"].map((id) => describeOpening(g, id));
    };
    expect(pos([r2, r1])).toEqual(pos([r1, r2]));
  });
});
