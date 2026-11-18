// Phase 2 Stage 3a: Mode B wall uniqueness. Walls drawn as separate LINEs are
// merged by mergeCollinear (no `side`, explicit tolerances) so each physical run
// is one wall, while openings, rooms and every non-overlapping wall stay exactly
// as before.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dxfToGeometry } from "./dxf-to-geometry";
import { parseDxf } from "./parse-dxf";
import { ParseReport } from "./report";
import { MODE_B_MERGE_OPTIONS } from "./mode-b-walls";
import { FIXTURES } from "../eval/fixtures";

type P = [number, number];
const line = (layer: string, a: P, b: P) => ({
  type: "LINE",
  layer,
  vertices: [
    { x: a[0], y: a[1] },
    { x: b[0], y: b[1] },
  ],
});
const W = (a: P, b: P) => line("WALLS", a, b);
const arc = (c: P, r: number, s: number, e: number) => ({
  type: "ARC",
  layer: "DOORS",
  center: { x: c[0], y: c[1] },
  radius: r,
  startAngle: s,
  endAngle: e,
});

function run(entities: unknown[], unitTrusted = true) {
  const report = new ParseReport();
  const geometry = dxfToGeometry({ entities } as never, undefined, {
    report,
    unitTrusted,
  });
  return { geometry, meta: report.toMeta({} as never) };
}

const r6 = (n: number) => Math.round(n * 1e6) / 1e6 + 0;
const total = (g: { walls: { length: number }[] }) =>
  r6(g.walls.reduce((s, w) => s + w.length, 0));
/** each wall as an undirected, sorted endpoint pair, so direction never matters */
const ends = (g: ReturnType<typeof run>["geometry"]) =>
  g.walls
    .map((w) =>
      [
        [r6(w.startX), r6(w.startY)],
        [r6(w.endX), r6(w.endY)],
      ]
        .sort((p, q) => p[0] - q[0] || p[1] - q[1])
        .flat(),
    )
    .sort((p, q) => {
      for (let i = 0; i < 4; i++) if (p[i] !== q[i]) return p[i] - q[i];
      return 0;
    });
const codes = (m: { warnings: { code: string }[] }) =>
  m.warnings.map((w) => w.code);
const tilted = (len: number, deg: number): P => [
  len,
  len * Math.tan((deg * Math.PI) / 180),
];

describe("explicit Stage 3a tolerances", () => {
  it("are the approved values", () => {
    expect(MODE_B_MERGE_OPTIONS.offsetTol).toBe(0.05);
    expect(MODE_B_MERGE_OPTIONS.minOverlap).toBe(0.1);
    expect(MODE_B_MERGE_OPTIONS.angleTolRad).toBeCloseTo(
      (0.5 * Math.PI) / 180,
      12,
    );
  });
});

describe("INV-2: each physical wall run is one wall", () => {
  const cases: {
    name: string;
    lines: [P, P][];
    expected: number[][];
    length: number;
  }[] = [
    {
      name: "exact duplicate",
      lines: [
        [
          [0, 0],
          [10, 0],
        ],
        [
          [0, 0],
          [10, 0],
        ],
      ],
      expected: [[0, 0, 10, 0]],
      length: 10,
    },
    {
      name: "reversed duplicate",
      lines: [
        [
          [0, 0],
          [10, 0],
        ],
        [
          [10, 0],
          [0, 0],
        ],
      ],
      expected: [[0, 0, 10, 0]],
      length: 10,
    },
    {
      name: "partial overlap 0..10 and 6..16",
      lines: [
        [
          [0, 0],
          [10, 0],
        ],
        [
          [6, 0],
          [16, 0],
        ],
      ],
      expected: [[0, 0, 16, 0]],
      length: 16,
    },
    {
      name: "contained 3..7 in 0..10",
      lines: [
        [
          [0, 0],
          [10, 0],
        ],
        [
          [3, 0],
          [7, 0],
        ],
      ],
      expected: [[0, 0, 10, 0]],
      length: 10,
    },
    {
      name: "three-segment overlap chain",
      lines: [
        [
          [0, 0],
          [10, 0],
        ],
        [
          [8, 0],
          [18, 0],
        ],
        [
          [16, 0],
          [26, 0],
        ],
      ],
      expected: [[0, 0, 26, 0]],
      length: 26,
    },
    {
      name: "reversed second segment, partial overlap",
      lines: [
        [
          [0, 0],
          [10, 0],
        ],
        [
          [16, 0],
          [6, 0],
        ],
      ],
      expected: [[0, 0, 16, 0]],
      length: 16,
    },
    {
      name: "vertical partial overlap",
      lines: [
        [
          [5, 0],
          [5, 10],
        ],
        [
          [5, 6],
          [5, 16],
        ],
      ],
      expected: [[5, 0, 5, 16]],
      length: 16,
    },
  ];
  it.each(cases)("$name", ({ lines, expected, length }) => {
    const { geometry } = run(lines.map(([a, b]) => W(a, b)));
    expect(ends(geometry)).toEqual(expected);
    expect(total(geometry)).toBe(length);
  });

  it("a 0.03 ft offset duplicate is one wall on the longer wall's line", () => {
    const { geometry } = run([W([0, 0], [10, 0]), W([0, 0.03], [10, 0.03])]);
    expect(geometry.walls).toHaveLength(1);
    expect(total(geometry)).toBe(10);
  });

  it("a 0.1 degree tilted duplicate is one wall of the right length", () => {
    const { geometry } = run([W([0, 0], [10, 0]), W([0, 0], tilted(10, 0.1))]);
    expect(geometry.walls).toHaveLength(1);
    expect(total(geometry)).toBeCloseTo(10, 4);
  });

  it("order of the input does not change the physical result", () => {
    const lines = [W([0, 0], [10, 0]), W([6, 0], [16, 0]), W([3, 0], [7, 0])];
    const a = run(lines).geometry;
    const b = run([...lines].reverse()).geometry;
    expect(ends(b)).toEqual(ends(a));
    expect(total(b)).toBe(total(a));
  });

  it("reports what it merged, and nothing it did not", () => {
    const { meta } = run([
      W([0, 0], [10, 0]),
      W([6, 0], [16, 0]),
      W([3, 0], [7, 0]),
    ]);
    expect(meta.stats.wallsMerged).toBe(2);
    // inputs 10 + 10 + 4 = 24, union 16
    expect(meta.stats.wallLengthRemovedFt).toBe(8);
  });

  it("without overlaps there are no merge stats and no warnings", () => {
    const { meta } = run([W([0, 0], [10, 0]), W([10, 0], [10, 8])]);
    expect(meta.stats.wallsMerged).toBeUndefined();
    expect(meta.stats.wallLengthRemovedFt).toBeUndefined();
    expect(meta.warnings).toEqual([]);
  });
});

describe("tolerance boundaries (feet, after unit scaling)", () => {
  it.each([
    [0.049, 1],
    [0.05, 1],
    [0.051, 2],
    [0.06, 2],
  ])("parallel duplicate %s ft apart gives %s wall(s)", (gap, walls) => {
    const { geometry } = run([W([0, 0], [10, 0]), W([0, gap], [10, gap])]);
    expect(geometry.walls).toHaveLength(walls);
    if (walls === 2) {
      expect(total(geometry)).toBe(20); // both kept exactly as drawn
      expect(ends(geometry)).toEqual([
        [0, 0, 10, 0],
        [0, gap, 10, gap],
      ]);
    } else {
      expect(total(geometry)).toBe(10);
    }
  });

  it("a collinear overlap just under minOverlap (0.1 ft) stays separate; just over merges", () => {
    const a = run([W([0, 0], [5.09, 0]), W([5, 0], [10, 0])]).geometry;
    expect(a.walls).toHaveLength(2);
    const b = run([W([0, 0], [5.11, 0]), W([5, 0], [10, 0])]).geometry;
    expect(b.walls).toHaveLength(1);
    expect(total(b)).toBe(10);
  });

  it.each([
    [0.099, 2],
    [0.1, 2], // strictly greater than minOverlap is required
    [0.101, 1],
  ])(
    "collinear overlap of %s ft gives %s wall(s) (minOverlap 0.1, strict)",
    (ov, walls) => {
      const { geometry, meta } = run([
        W([0, 0], [5 + ov, 0]),
        W([5, 0], [10, 0]),
      ]);
      expect(geometry.walls).toHaveLength(walls);
      if (walls === 1) {
        expect(ends(geometry)).toEqual([[0, 0, 10, 0]]);
        expect(total(geometry)).toBe(10);
        expect(meta.stats.wallsMerged).toBe(1);
      } else {
        // kept exactly as drawn: the short overlap is a known, silent limitation
        expect(ends(geometry)).toEqual([
          [0, 0, r6(5 + ov), 0],
          [5, 0, 10, 0],
        ]);
        expect(total(geometry)).toBeCloseTo(10 + ov, 6);
        expect(meta.stats.wallsMerged).toBeUndefined();
        expect(meta.warnings).toEqual([]);
      }
    },
  );

  it("angle: 0.49 degrees merges, 0.51 degrees is kept separate and reported as ambiguous", () => {
    // short walls so the angle, not the offset, is what decides
    const inside = run([W([0, 0], [2, 0]), W([0, 0], tilted(2, 0.49))]);
    expect(inside.geometry.walls).toHaveLength(1);

    const outside = run([W([0, 0], [2, 0]), W([0, 0], tilted(2, 0.51))]);
    expect(outside.geometry.walls).toHaveLength(2);
    expect(codes(outside.meta)).toContain("WALL_ANGLE_AMBIGUOUS");
    const w = outside.meta.warnings.find(
      (x) => x.code === "WALL_ANGLE_AMBIGUOUS",
    )!;
    expect(w.severity).toBe("warning");
    expect(w.message).toMatch(/kept (as drawn|separate)/);
  });
});

describe("chain drift is reported and loses no length silently", () => {
  it("10 overlapping lines, each 0.04 ft above the last", () => {
    const lines: [P, P][] = [];
    for (let i = 0; i < 10; i++)
      lines.push([
        [i * 5, i * 0.04],
        [i * 5 + 6, i * 0.04],
      ]);
    const inputLength = lines.reduce(
      (s, [a, b]) => s + Math.hypot(b[0] - a[0], b[1] - a[1]),
      0,
    );
    const { geometry, meta } = run(lines.map(([a, b]) => W(a, b)));
    expect(codes(meta)).toContain("WALL_MERGE_CONFLICT");
    expect(geometry.walls.length).toBeLessThan(10); // merged what it safely could
    expect(geometry.walls.length).toBeGreaterThan(1); // and refused the rest
    // nothing lost beyond what was actually merged and reported
    expect(
      r6(total(geometry) + (meta.stats.wallLengthRemovedFt ?? 0)),
    ).toBeCloseTo(inputLength, 4);
  });
});

describe("legitimate distinct walls stay separate, with their geometry intact", () => {
  const same = (lines: [P, P][], len: number) => {
    const { geometry, meta } = run(lines.map(([a, b]) => W(a, b)));
    expect(geometry.walls).toHaveLength(lines.length);
    expect(ends(geometry)).toEqual(
      lines
        .map(([a, b]) =>
          [a, b].sort((p, q) => p[0] - q[0] || p[1] - q[1]).flat(),
        )
        .sort((p, q) => {
          for (let i = 0; i < 4; i++) if (p[i] !== q[i]) return p[i] - q[i];
          return 0;
        }),
    );
    expect(total({ walls: geometry.walls })).toBeCloseTo(len, 6);
    expect(meta.stats.wallsMerged).toBeUndefined();
  };

  it.each([0.06, 0.1, 0.375, 0.75, 1.0])("parallel walls %s ft apart", (gap) =>
    same(
      [
        [
          [0, 0],
          [10, 0],
        ],
        [
          [0, gap],
          [10, gap],
        ],
      ],
      20,
    ),
  );
  it("a 0.5 ft door gap between collinear walls", () =>
    same(
      [
        [
          [0, 0],
          [4.75, 0],
        ],
        [
          [5.25, 0],
          [10, 0],
        ],
      ],
      9.5,
    ));
  it("touching end-to-end collinear segments", () =>
    same(
      [
        [
          [0, 0],
          [5, 0],
        ],
        [
          [5, 0],
          [10, 0],
        ],
      ],
      10,
    ));
  it("T-junction", () =>
    same(
      [
        [
          [0, 0],
          [10, 0],
        ],
        [
          [5, 0],
          [5, 8],
        ],
      ],
      18,
    ));
  it("cross-junction", () =>
    same(
      [
        [
          [0, 5],
          [10, 5],
        ],
        [
          [5, 0],
          [5, 10],
        ],
      ],
      20,
    ));
  it("L-corner", () =>
    same(
      [
        [
          [0, 0],
          [10, 0],
        ],
        [
          [10, 0],
          [10, 8],
        ],
      ],
      18,
    ));
  it("near-intersections (stem 0.02 and 0.3 ft short of the wall)", () => {
    same(
      [
        [
          [0, 0],
          [10, 0],
        ],
        [
          [5, 0.02],
          [5, 8],
        ],
      ],
      17.98,
    );
    same(
      [
        [
          [0, 0],
          [10, 0],
        ],
        [
          [5, 0.3],
          [5, 8],
        ],
      ],
      17.7,
    );
  });
  it("two collinear runs far apart", () =>
    same(
      [
        [
          [0, 0],
          [5, 0],
        ],
        [
          [30, 0],
          [35, 0],
        ],
      ],
      10,
    ));
  it("a double-line pair (faces 0.75 ft apart) is NOT collapsed", () => {
    const g = (d: number): [P, P][] => [
      [
        [0, 0],
        [20, 0],
      ],
      [
        [20, 0],
        [20, 12],
      ],
      [
        [20, 12],
        [0, 12],
      ],
      [
        [0, 12],
        [0, 0],
      ],
      [
        [d, d],
        [20 - d, d],
      ],
      [
        [20 - d, d],
        [20 - d, 12 - d],
      ],
      [
        [20 - d, 12 - d],
        [d, 12 - d],
      ],
      [
        [d, 12 - d],
        [d, d],
      ],
    ];
    const { geometry } = run(g(0.75).map(([a, b]) => W(a, b)));
    expect(geometry.walls).toHaveLength(8);
    expect(total(geometry)).toBe(122);
  });
});

describe("INV-1: openings are placed exactly as before the merge", () => {
  // Every case is run twice: the new path and the legacy path (unit not trusted
  // = no merging, exactly the previous pipeline). Openings must be identical.
  const scenarios: Record<string, unknown[]> = {
    "window on the overlap": [
      W([0, 0], [10, 0]),
      W([6, 0], [16, 0]),
      line("WINDOWS", [7, 0], [9, 0]),
    ],
    "door on the portion only the second segment covers": [
      W([0, 0], [10, 0]),
      W([6, 0], [16, 0]),
      line("DOORS", [12, 0], [15, 0]),
    ],
    "door spanning both segments": [
      W([0, 0], [10, 0]),
      W([6, 0], [16, 0]),
      line("DOORS", [8, 0], [12, 0]),
    ],
    "hinge door, no arc, reversed second segment": [
      W([0, 0], [10, 0]),
      W([16, 0], [6, 0]),
      line("DOORS", [12, 0], [12, 3]),
    ],
    "hinge door, no arc, reversed segment listed first": [
      W([16, 0], [6, 0]),
      W([0, 0], [10, 0]),
      line("DOORS", [12, 0], [12, 3]),
    ],
    "hinge door with a swing arc, reversed second segment": [
      W([0, 0], [10, 0]),
      W([16, 0], [6, 0]),
      line("DOORS", [12, 0], [12, 3]),
      arc([12, 0], 3, 0, Math.PI / 2),
    ],
    "door near a T-junction": [
      W([0, 0], [20, 0]),
      W([8, 0], [18, 0]),
      W([10, 0], [10, 8]),
      line("DOORS", [9.5, 0], [9.5, 3]),
    ],
    "several openings on one merged wall": [
      W([0, 0], [10, 0]),
      W([6, 0], [16, 0]),
      line("WINDOWS", [2, 0], [4, 0]),
      line("DOORS", [12, 0], [15, 0]),
      line("WINDOWS", [7, 0], [9, 0]),
    ],
    "no overlaps at all (control)": [
      W([0, 0], [20, 0]),
      W([20, 0], [20, 10]),
      line("DOORS", [5, 0], [8, 0]),
    ],
  };
  it.each(Object.entries(scenarios))("%s", (_name, entities) => {
    const now = run(entities, true).geometry;
    const before = run(entities, false).geometry;
    expect(now.openings).toEqual(before.openings);
    expect(JSON.stringify(now.openings)).toBe(JSON.stringify(before.openings));
    expect(now.rooms).toEqual(before.rooms);
  });

  it("the confirmed regression: the hinge door does not move 3 ft", () => {
    const { geometry } = run(
      scenarios["hinge door, no arc, reversed second segment"],
    );
    const [door] = geometry.openings;
    // pre-change values, captured from the previous pipeline
    expect(door.x).toBe(10.5);
    expect(door.y).toBeCloseTo(0, 12);
    expect(door.angle).toBeCloseTo(Math.PI, 12);
    expect(door.hingeX).toBe(12);
    expect(door.hingeY).toBe(0);
    expect(door.openAngle).toBeCloseTo(Math.PI / 2, 12);
    expect(door.x).not.toBe(13.5); // what merged-wall snapping gave
    // ...while the wall itself is one run
    expect(geometry.walls).toHaveLength(1);
    expect(total(geometry)).toBe(16);
  });

  it("literal pre-change placements", () => {
    const at = (name: string) =>
      run(scenarios[name]).geometry.openings.map((o) => [
        o.id,
        o.x,
        o.y,
        o.angle,
        o.width,
        o.height,
      ]);
    expect(at("window on the overlap")).toEqual([["window-0", 8, 0, 0, 2, 4]]);
    expect(at("door on the portion only the second segment covers")).toEqual([
      ["door-0", 13.5, 0, 0, 3, 7],
    ]);
    expect(at("door spanning both segments")).toEqual([
      ["door-0", 10, 0, 0, 4, 7],
    ]);
    expect(at("several openings on one merged wall")).toEqual([
      ["door-0", 13.5, 0, 0, 3, 7],
      ["window-0", 3, 0, 0, 2, 4],
      ["window-1", 8, 0, 0, 2, 4],
    ]);
  });

  it("every opening still sits on a wall of the output", () => {
    for (const entities of Object.values(scenarios)) {
      const g = run(entities).geometry;
      for (const o of g.openings) {
        const near = g.walls.some((w) => {
          const dx = w.endX - w.startX;
          const dy = w.endY - w.startY;
          const t = Math.max(
            0,
            Math.min(
              1,
              ((o.x! - w.startX) * dx + (o.y! - w.startY) * dy) /
                (dx * dx + dy * dy),
            ),
          );
          return (
            Math.hypot(o.x! - (w.startX + t * dx), o.y! - (w.startY + t * dy)) <
            0.01
          );
        });
        expect(near).toBe(true);
      }
    }
  });
});

describe("INV-3 / INV-4: room detection is unchanged", () => {
  it("rooms come from the pre-merge segments, identical with and without merging", () => {
    const house = [
      W([0, 0], [20, 0]),
      W([20, 0], [20, 12]),
      W([20, 12], [0, 12]),
      W([0, 12], [0, 0]),
      W([10, 0], [10, 12]),
      W([0, 0], [8, 0]), // overlaps the bottom wall
    ];
    const now = run(house, true).geometry;
    const before = run(house, false).geometry;
    expect(now.rooms).toEqual(before.rooms);
    expect(now.rooms.map((r) => r.area).sort()).toEqual([120, 120]);
    expect(now.walls.length).toBe(before.walls.length - 1);
  });
});

describe("thickness is classified after merging", () => {
  it("a wall duplicated 0.03 ft outside the drawing's edge no longer turns the real wall into a partition", () => {
    const box = [
      W([0, 0], [20, 0]),
      W([20, 0], [20, 12]),
      W([20, 12], [0, 12]),
      W([0, 12], [0, 0]),
      W([10, 0], [10, 12]),
    ];
    const g = run([...box, W([0, -0.03], [20, -0.03])]).geometry;
    expect(g.walls.map((w) => w.thickness)).toEqual([
      0.75, 0.75, 0.75, 0.75, 0.375,
    ]);
  });
});

describe("unit trust", () => {
  const dxfText = (insunits: number | null, lines: [P, P][]) =>
    [
      "0",
      "SECTION",
      "2",
      "HEADER",
      ...(insunits === null ? [] : ["9", "$INSUNITS", "70", String(insunits)]),
      "0",
      "ENDSEC",
      "0",
      "SECTION",
      "2",
      "ENTITIES",
      ...lines.flatMap(([a, b]) => [
        "0",
        "LINE",
        "8",
        "WALLS",
        "10",
        String(a[0]),
        "20",
        String(a[1]),
        "30",
        "0",
        "11",
        String(b[0]),
        "21",
        String(b[1]),
        "31",
        "0",
      ]),
      "0",
      "ENDSEC",
      "0",
      "EOF",
    ].join("\n");
  const house: [P, P][] = [
    [
      [0, 0],
      [20, 0],
    ],
    [
      [20, 0],
      [20, 12],
    ],
    [
      [20, 12],
      [0, 12],
    ],
    [
      [0, 12],
      [0, 0],
    ],
    [
      [6, 0],
      [26, 0],
    ], // overlaps the bottom wall
  ];

  it("a trusted header unit (feet): overlap merged", () => {
    const { geometry, meta } = parseDxf(dxfText(2, house));
    expect(meta.unit.needsConfirmation).toBe(false);
    expect(geometry.walls).toHaveLength(4);
    expect(meta.stats.wallsMerged).toBe(1);
  });

  it("an unconfirmed unitless drawing: provisional geometry is NOT merged (legacy behaviour), and records that", () => {
    const { geometry, meta } = parseDxf(dxfText(null, house));
    expect(meta.unit.needsConfirmation).toBe(true);
    expect(geometry.walls).toHaveLength(5);
    expect(meta.stats.wallsMerged).toBeUndefined();
    expect(meta.stats.wallMergeSkippedUnitUnconfirmed).toBe(1);
    expect(meta.warnings.map((x) => x.code)).toContain(
      "UNIT_CONFIRMATION_REQUIRED",
    );
  });

  it("once the unit is confirmed, the same drawing is merged", () => {
    const { geometry, meta } = parseDxf(dxfText(null, house), {
      confirmedUnit: "foot",
    });
    expect(meta.unit.needsConfirmation).toBe(false);
    expect(geometry.walls).toHaveLength(4);
    expect(meta.stats.wallsMerged).toBe(1);
    expect(meta.stats.wallMergeSkippedUnitUnconfirmed).toBeUndefined();
  });

  describe("merging is strictly opt-in (fails closed)", () => {
    const entities = house.map(([a, b]) => W(a, b));
    const legacy = dxfToGeometry({ entities } as never, undefined, {
      unitTrusted: false,
    });
    const walls = (g: { walls: unknown[] }) => g.walls.length;

    it("only an explicit unitTrusted: true merges", () => {
      expect(
        walls(
          dxfToGeometry({ entities } as never, undefined, {
            unitTrusted: true,
          }),
        ),
      ).toBe(4);
    });

    it.each([
      ["no context at all", () => dxfToGeometry({ entities } as never)],
      [
        "an empty context",
        () => dxfToGeometry({ entities } as never, undefined, {}),
      ],
      [
        "context with a report but no unitTrusted",
        () =>
          dxfToGeometry({ entities } as never, undefined, {
            report: new ParseReport(),
          }),
      ],
      [
        "unitTrusted: undefined",
        () =>
          dxfToGeometry({ entities } as never, undefined, {
            unitTrusted: undefined,
          }),
      ],
      [
        "unitTrusted: false",
        () =>
          dxfToGeometry({ entities } as never, undefined, {
            unitTrusted: false,
          }),
      ],
    ])("%s does not merge and equals the legacy geometry", (_n, call) => {
      const g = call();
      expect(walls(g)).toBe(5);
      expect(g).toEqual(legacy);
    });

    it("an omitted flag records no merge stats and no merge warnings", () => {
      const report = new ParseReport();
      dxfToGeometry({ entities } as never, undefined, { report });
      const meta = report.toMeta({} as never);
      expect(meta.stats.wallsMerged).toBeUndefined();
      expect(meta.warnings.filter((w) => w.code.startsWith("WALL_"))).toEqual(
        [],
      );
      expect(meta.stats.wallMergeSkippedUnitUnconfirmed).toBe(1);
    });
  });
});

describe("existing Mode B fixtures are unchanged", () => {
  const expected: Record<string, [number, number, number, number, number]> = {
    whole_house_simple_plan: [12, 260.827, 7, 7, 8],
    whole_house_connected: [9, 260.827, 7, 8, 8],
  };
  for (const [name, [walls, len, rooms, doors, windows]] of Object.entries(
    expected,
  ))
    // These fixtures carry no $INSUNITS, so a default parse is provisional (no
    // merging) and a parse with the unit confirmed merges. Both must give the
    // baseline: the drawings contain no overlapping walls.
    it.each([
      ["unit not confirmed (provisional)", undefined],
      ["unit confirmed as millimetres", "millimetre" as const],
    ])(`${name}, %s`, (label, confirmedUnit) => {
      const f = FIXTURES.find((x) => x.name === name)!;
      const { geometry, meta } = parseDxf(readFileSync(f.path, "utf8"), {
        confirmedUnit,
      });
      expect(meta.unit.needsConfirmation).toBe(confirmedUnit === undefined);
      expect(geometry.walls).toHaveLength(walls);
      expect(total(geometry)).toBeCloseTo(len, 3);
      expect(geometry.rooms).toHaveLength(rooms);
      expect(geometry.openings.filter((o) => o.type === "door")).toHaveLength(
        doors,
      );
      expect(geometry.openings.filter((o) => o.type === "window")).toHaveLength(
        windows,
      );
      expect(meta.stats.wallsMerged).toBeUndefined();
      expect(
        meta.warnings
          .filter((w) => w.code.startsWith("WALL_"))
          .map((w) => w.code),
      ).toEqual([]);
      expect(meta.stats.wallMergeSkippedUnitUnconfirmed).toBe(
        confirmedUnit === undefined ? 1 : undefined,
      );
    });
});
