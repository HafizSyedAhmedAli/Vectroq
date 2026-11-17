// What sample-house.dxf must look like after Mode A shared-wall merging (Phase 2,
// Stage 2), asserted on the three places a browser test can see it: the geometry
// the server saved, the editor fields on the page, and the summary tiles.
//
// The numbers are the parser's output for this fixture, pinned by
// packages/cad-parser/src/mode-a-shared-walls.test.ts (block A) and the legacy
// baseline. They are literals here on purpose: if the parser drifts, this fails
// in the browser too.
//   walls   10 (12 outline edges; the two shared edges at x=20 and x=35 are one wall each)
//   length  138 ft (was 158 before the merge)
//   rooms   Kitchen 240, Living Room 270, Bathroom 48 sq ft = 558
//   doors   1 at (20, 5.5), 3 ft wide, 7 ft high, on the shared wall at x=20
//   windows 1 at (0, 5), 4 ft wide, 4 ft high
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export const SAMPLE_HOUSE = {
  walls: 10,
  totalWallLengthFt: 138,
  rooms: [
    { name: "Kitchen", area: 240 },
    { name: "Living Room", area: 270 },
    { name: "Bathroom", area: 48 },
  ],
  totalAreaSqFt: 558,
  door: { x: 20, y: 5.5, width: 3, height: 7, angle: Math.PI / 2 },
  window: { x: 0, y: 5, width: 4, height: 4, angle: -Math.PI / 2 },
} as const;

interface Wall {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  length: number;
}
interface Opening {
  id: string;
  type: string;
  x?: number;
  y?: number;
  width: number;
  height: number;
  angle?: number;
}
export interface SampleGeometry {
  walls: Wall[];
  rooms: { name: string; area: number }[];
  openings: Opening[];
}

/** The geometry as saved by the server / returned by the upload route. */
export function expectSampleHouseGeometry(g: SampleGeometry, where: string) {
  const E = SAMPLE_HOUSE;
  expect(g.walls, `${where}: wall count`).toHaveLength(E.walls);
  const total = g.walls.reduce((s, w) => s + w.length, 0);
  expect(total, `${where}: total wall length`).toBeCloseTo(
    E.totalWallLengthFt,
    6,
  );
  // The two shared walls exist once, at full length, and their duplicates are gone.
  const byId = new Map(g.walls.map((w) => [w.id, w]));
  expect(byId.size, `${where}: wall ids are unique`).toBe(E.walls);
  for (const [id, x] of [
    ["wall-0-1", 20],
    ["wall-1-1", 35],
  ] as const) {
    const w = byId.get(id);
    expect(w, `${where}: ${id} present`).toBeDefined();
    expect(
      [w!.startX, w!.startY, w!.endX, w!.endY, w!.length],
      `${where}: ${id}`,
    ).toEqual([x, 0, x, 18, 18]);
  }
  for (const gone of ["wall-1-3", "wall-2-3"])
    expect(byId.has(gone), `${where}: ${gone} was merged away`).toBe(false);

  expect(
    g.rooms.map((r) => [r.name, r.area]),
    `${where}: rooms`,
  ).toEqual(E.rooms.map((r) => [r.name, r.area]));
  expect(
    g.rooms.reduce((s, r) => s + r.area, 0),
    `${where}: covered area`,
  ).toBe(E.totalAreaSqFt);

  expect(g.openings, `${where}: openings`).toHaveLength(2);
  const door = g.openings.find((o) => o.type === "door");
  const win = g.openings.find((o) => o.type === "window");
  for (const [name, o, e] of [
    ["door", door, E.door],
    ["window", win, E.window],
  ] as const) {
    expect(o, `${where}: ${name} present`).toBeDefined();
    for (const k of ["x", "y", "width", "height", "angle"] as const)
      expect(o![k], `${where}: ${name}.${k}`).toBeCloseTo(e[k], 9);
  }
}

/** The editor fields and summary tiles on the project page (rounded where the UI rounds). */
export async function expectSampleHouseOnPage(page: Page, where: string) {
  const E = SAMPLE_HOUSE;
  const lengths = page.getByLabel(/^Wall \d+ length$/);
  await expect(lengths, `${where}: wall fields`).toHaveCount(E.walls);
  const values = await lengths.evaluateAll((els) =>
    els.map((el) => Number((el as HTMLInputElement).value)),
  );
  expect(
    values.reduce((s, v) => s + v, 0),
    `${where}: sum of the wall length fields`,
  ).toBeCloseTo(E.totalWallLengthFt, 6);

  for (const [i, r] of E.rooms.entries()) {
    await expect(
      page.getByLabel(`Room ${i + 1} name`),
      `${where}: room ${i + 1} name`,
    ).toHaveValue(r.name);
    await expect(
      page.getByLabel(`Room ${i + 1} area`),
      `${where}: room ${i + 1} area`,
    ).toHaveValue(String(r.area));
  }

  // Summary tiles: label, then its value in the next paragraph. The UI rounds and
  // adds units, so match the number and unit rather than an exact string.
  const tile = (label: string) =>
    page
      .getByText(label, { exact: true })
      .locator("xpath=following-sibling::p[1]");
  await expect(tile("Wall length"), `${where}: wall length tile`).toHaveText(
    /^138\s*ft$/,
  );
  await expect(tile("Covered area"), `${where}: covered area tile`).toHaveText(
    /^558\s*sq ft$/,
  );
  await expect(tile("Doors / windows"), `${where}: openings tile`).toHaveText(
    /^1\s*\/\s*1$/,
  );
}
