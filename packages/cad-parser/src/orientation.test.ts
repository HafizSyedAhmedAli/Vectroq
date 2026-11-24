// Phase 2, Stage 3b: orientation detection (pure, no pipeline).
import { describe, expect, it } from "vitest";
import {
  canonicalOrientation,
  collapseCollinear,
  detectOrientation,
  wallSegmentsOf,
  wrapQuarter,
  type Seg,
} from "./orientation";

type P = [number, number];
const D = Math.PI / 180;
const rotP = ([x, y]: P, a: number): P => [
  x * Math.cos(a) - y * Math.sin(a),
  x * Math.sin(a) + y * Math.cos(a),
];
const edges = (poly: P[], a = 0): Seg[] =>
  poly.map((p, i) => {
    const q = poly[(i + 1) % poly.length];
    const [x1, y1] = rotP(p, a);
    const [x2, y2] = rotP(q, a);
    return { x1, y1, x2, y2 };
  });
const seg = (p: P, q: P, a = 0): Seg => {
  const [x1, y1] = rotP(p, a);
  const [x2, y2] = rotP(q, a);
  return { x1, y1, x2, y2 };
};

const RECT: P[] = [
  [0, 0],
  [30, 0],
  [30, 20],
  [0, 20],
];
const L: P[] = [
  [0, 0],
  [30, 0],
  [30, 10],
  [15, 10],
  [15, 20],
  [0, 20],
];
const U: P[] = [
  [0, 0],
  [30, 0],
  [30, 20],
  [20, 20],
  [20, 8],
  [10, 8],
  [10, 20],
  [0, 20],
];
const PLUS: P[] = [
  [10, 0],
  [20, 0],
  [20, 10],
  [30, 10],
  [30, 20],
  [20, 20],
  [20, 30],
  [10, 30],
  [10, 20],
  [0, 20],
  [0, 10],
  [10, 10],
];
const NARROW: P[] = [
  [0, 0],
  [100, 0],
  [100, 3],
  [0, 3],
];

describe("canonical angle", () => {
  it("wrapQuarter / canonicalOrientation land in (-pi/4, pi/4] for every input", () => {
    for (let d = -720; d <= 720; d += 0.5) {
      const c = canonicalOrientation(d * D);
      expect(c).toBeGreaterThan(-Math.PI / 4);
      expect(c).toBeLessThanOrEqual(Math.PI / 4);
    }
  });
  it("the -45 degree boundary maps to +45", () => {
    expect(canonicalOrientation(-Math.PI / 4)).toBe(Math.PI / 4);
    expect(canonicalOrientation(Math.PI / 4)).toBe(Math.PI / 4);
    expect(canonicalOrientation((3 * Math.PI) / 4)).toBe(Math.PI / 4);
    expect(wrapQuarter(-Math.PI / 4)).toBe(Math.PI / 4);
  });
  it("values within an ulp of the boundary never fall outside the interval", () => {
    for (const a of [
      Math.PI / 4,
      -Math.PI / 4,
      Math.PI / 4 + 1e-16,
      -Math.PI / 4 - 1e-16,
      Math.PI / 4 - 1e-15,
      -Math.PI / 4 + 1e-15,
      -Math.PI / 4 - 5e-16,
    ]) {
      const c = canonicalOrientation(a);
      expect(c).toBeGreaterThan(-Math.PI / 4);
      expect(c).toBeLessThanOrEqual(Math.PI / 4);
    }
  });
});

describe("angle table (rectangle)", () => {
  const cases = [
    0.01, 0.1, 1, 15, 30, 44, -0.01, -0.1, -1, -15, -30, -44, 44.99, -44.99,
  ];
  for (const deg of cases)
    it(`${deg} degrees: detected ${deg}, applied ${-deg}, result is axis-aligned`, () => {
      const segs = edges(RECT, deg * D);
      const r = detectOrientation(segs);
      expect(r.status).toBe("rotate");
      expect(r.detectedRad).toBeCloseTo(deg * D, 9);
      expect(r.rotationRad).toBeCloseTo(-deg * D, 9);
      // applying the rotation makes every segment axis-aligned
      for (const s of edges(RECT, deg * D)) {
        const [x1, y1] = rotP([s.x1, s.y1], r.rotationRad);
        const [x2, y2] = rotP([s.x2, s.y2], r.rotationRad);
        expect(Math.min(Math.abs(x2 - x1), Math.abs(y2 - y1))).toBeLessThan(
          1e-9,
        );
      }
    });

  it("0 degrees: aligned, nothing applied", () => {
    const r = detectOrientation(edges(RECT));
    expect(r.status).toBe("aligned");
    expect(r.rotationRad).toBe(0);
    expect(Object.is(r.rotationRad, -0)).toBe(false);
  });

  for (const deg of [
    45,
    -45,
    135,
    45 + 1e-9,
    45 - 1e-9,
    -45 + 1e-9,
    -45 - 1e-9,
  ])
    it(`boundary ${deg}: canonical result inside (-45, 45], plan ends up axis-aligned`, () => {
      const r = detectOrientation(edges(RECT, deg * D));
      expect(r.status).toBe("rotate");
      expect(r.detectedRad).toBeGreaterThan(-Math.PI / 4);
      expect(r.detectedRad).toBeLessThanOrEqual(Math.PI / 4);
      expect(Math.abs(Math.abs(r.detectedRad) - Math.PI / 4)).toBeLessThan(
        1e-6,
      );
      for (const s of edges(RECT, deg * D)) {
        const [x1, y1] = rotP([s.x1, s.y1], r.rotationRad);
        const [x2, y2] = rotP([s.x2, s.y2], r.rotationRad);
        expect(Math.min(Math.abs(x2 - x1), Math.abs(y2 - y1))).toBeLessThan(
          1e-7,
        );
      }
    });

  it("a sweep of angles is recovered to 1e-9 rad", () => {
    for (let deg = -44.5; deg <= 44.5; deg += 0.73) {
      const r = detectOrientation(edges(L, deg * D));
      expect(r.status).toBe("rotate");
      expect(r.detectedRad).toBeCloseTo(deg * D, 9);
    }
  });
});

describe("plan shapes", () => {
  const shapes: [string, P[]][] = [
    ["rectangle", RECT],
    ["L", L],
    ["U", U],
    ["multi-wing (plus)", PLUS],
    ["long narrow rectangle", NARROW],
  ];
  for (const [name, poly] of shapes)
    for (const deg of [-37, -3, 12, 29])
      it(`${name} at ${deg} degrees is detected`, () => {
        const r = detectOrientation(edges(poly, deg * D));
        expect(r.status).toBe("rotate");
        expect(r.detectedRad).toBeCloseTo(deg * D, 9);
      });

  it("an internal diagonal wall does not move the estimate", () => {
    for (const deg of [-25, 18]) {
      const segs = [
        ...edges(L, deg * D),
        seg([3, 3], [12, 9], deg * D),
        seg([18, 12], [27, 4], deg * D),
      ];
      const r = detectOrientation(segs);
      expect(r.status).toBe("rotate");
      expect(r.detectedRad).toBeCloseTo(deg * D, 6);
    }
  });

  it("one or two stray diagonal segments do not move the estimate", () => {
    for (const stray of [
      [seg([100, 100], [103, 104])],
      [seg([100, 100], [103, 104]), seg([-50, 7], [-47, 10])],
    ]) {
      const r = detectOrientation([...edges(U, 20 * D), ...stray]);
      expect(r.status).toBe("rotate");
      expect(r.detectedRad).toBeCloseTo(20 * D, 5);
    }
  });

  it("duplicate shared-wall edges (exact, reversed, partial, contained) do not move the estimate", () => {
    // two rooms sharing the x = 20 wall, a third wing sharing part of it
    const rooms: P[][] = [
      [
        [0, 0],
        [20, 0],
        [20, 10],
        [0, 10],
      ],
      [
        [20, 0],
        [40, 0],
        [40, 10],
        [20, 10],
      ],
      [
        [20, 10],
        [40, 10],
        [40, 30],
        [20, 30],
      ],
    ];
    for (const deg of [-33, 8]) {
      const once = rooms.flatMap((r) => edges(r, deg * D));
      // add reversed and contained copies of every edge as well
      const dups = once.flatMap((s) => [
        s,
        { x1: s.x2, y1: s.y2, x2: s.x1, y2: s.y1 },
        {
          x1: s.x1 + (s.x2 - s.x1) * 0.25,
          y1: s.y1 + (s.y2 - s.y1) * 0.25,
          x2: s.x1 + (s.x2 - s.x1) * 0.75,
          y2: s.y1 + (s.y2 - s.y1) * 0.75,
        },
      ]);
      const a = detectOrientation(once);
      const b = detectOrientation(dups);
      expect(b.status).toBe("rotate");
      expect(b.detectedRad).toBeCloseTo(deg * D, 9);
      expect(b.eligibleSegments).toBe(a.eligibleSegments);
      expect(b.dominantShare).toBeCloseTo(a.dominantShare, 9);
    }
  });

  it("a heavily duplicated minority orientation cannot out-vote the plan", () => {
    // 30 identical copies of one diagonal, which would dominate without the collapse
    const diag = Array.from({ length: 30 }, () => seg([0, 0], [10, 10], 0));
    const r = detectOrientation([
      ...edges(RECT, 17 * D),
      ...diag.map((s) => ({ ...s, x1: s.x1 + 50, x2: s.x2 + 50 })),
    ]);
    expect(r.detectedRad).toBeCloseTo(17 * D, 6);
  });
});

describe("collapseCollinear", () => {
  it("merges exact, reversed, partial and contained duplicates into the union", () => {
    const out = collapseCollinear(
      [
        { x1: 0, y1: 0, x2: 10, y2: 0 },
        { x1: 10, y1: 0, x2: 0, y2: 0 },
        { x1: 2, y1: 0, x2: 5, y2: 0 },
        { x1: 8, y1: 0, x2: 15, y2: 0 },
      ],
      1e-9,
    );
    expect(out).toHaveLength(1);
    expect(
      Math.hypot(out[0].x2 - out[0].x1, out[0].y2 - out[0].y1),
    ).toBeCloseTo(15, 12);
  });
  it("keeps separate parallel walls even when close together", () => {
    const out = collapseCollinear(
      [
        { x1: 0, y1: 0, x2: 10, y2: 0 },
        { x1: 0, y1: 0.01, x2: 10, y2: 0.01 },
        { x1: 0, y1: 1e-6, x2: 10, y2: 1e-6 },
      ],
      1e-9 * 10,
    );
    expect(out).toHaveLength(3);
  });
  it("keeps disjoint collinear pieces apart", () => {
    expect(
      collapseCollinear(
        [
          { x1: 0, y1: 0, x2: 4, y2: 0 },
          { x1: 6, y1: 0, x2: 10, y2: 0 },
        ],
        1e-9,
      ),
    ).toHaveLength(2);
  });
  it("does not modify its input", () => {
    const s = [
      { x1: 0, y1: 0, x2: 10, y2: 0 },
      { x1: 10, y1: 0, x2: 0, y2: 0 },
    ];
    const copy = JSON.stringify(s);
    collapseCollinear(s, 1e-9);
    expect(JSON.stringify(s)).toBe(copy);
  });
});

describe("confidence and false-positive protection", () => {
  it("fewer than 4 eligible segments: no rotation and no warning", () => {
    const r = detectOrientation([
      seg([0, 0], [30, 0], 20 * D),
      seg([30, 0], [30, 20], 20 * D),
      seg([30, 20], [0, 20], 20 * D),
    ]);
    expect(r.status).toBe("insufficient");
    expect(r.rotationRad).toBe(0);
  });
  it("nothing at all: insufficient", () => {
    expect(detectOrientation([]).status).toBe("insufficient");
  });
  it("axis-aligned plans are 'aligned' with no rotation", () => {
    for (const poly of [RECT, L, U, PLUS, NARROW]) {
      const r = detectOrientation(edges(poly));
      expect(r.status).toBe("aligned");
      expect(r.rotationRad).toBe(0);
    }
  });
  it("four parallel segments with no perpendicular family are not rotated", () => {
    const segs = [0, 5, 10, 15].map((y) => seg([0, y], [30, y], 20 * D));
    const r = detectOrientation(segs);
    expect(r.status).toBe("uncertain");
    expect(r.rotationRad).toBe(0);
    expect(r.reason).toMatch(/perpendicular/);
  });
  it("only two floating perpendicular stubs do not establish an orientation", () => {
    const segs = [
      ...[0, 5, 10, 15].map((y) => seg([0, y], [30, y], 20 * D)),
      seg([40, 0], [40, 3], 20 * D), // not touching any parallel wall
      seg([50, 0], [50, 3], 20 * D),
    ];
    const r = detectOrientation(segs);
    expect(r.status).not.toBe("rotate");
    expect(r.rotationRad).toBe(0);
  });
  it("perpendicular walls bridging two parallel walls but covering <50% of the extent are not enough", () => {
    const segs = [
      seg([0, 0], [100, 0], 20 * D),
      seg([0, 10], [100, 10], 20 * D),
      seg([0, 0], [0, 10], 20 * D),
      seg([20, 0], [20, 10], 20 * D), // span 20 of 100
    ];
    expect(detectOrientation(segs).status).toBe("uncertain");
  });
  it("a plan whose walls are mostly diagonal clutter is not rotated", () => {
    const clutter = Array.from({ length: 12 }, (_, i) =>
      seg([i * 7, 0], [i * 7 + 5, 4 + (i % 3)]),
    );
    const r = detectOrientation([...edges(RECT, 12 * D), ...clutter]);
    expect(r.rotationRad).toBe(0);
  });
  it("a competing family at least half as long as the dominant family blocks rotation", () => {
    // axis family at 10 degrees (L-shape, ~120 ft) plus a second grid at 40 degrees of equal weight
    const r = detectOrientation([
      ...edges(RECT, 10 * D),
      ...edges(RECT, 40 * D),
    ]);
    expect(r.status === "rotate").toBe(false);
    expect(r.rotationRad).toBe(0);
  });
  it("the strict touching tolerance accepts exact corners and rejects a 1e-3 ft gap", () => {
    const base = (gap: number) => [
      seg([0, 0], [30, 0], 20 * D),
      seg([0, 20], [30, 20], 20 * D),
      seg([0, 0], [0, 20 - gap], 20 * D),
      seg([30, 0], [30, 20 - gap], 20 * D),
    ];
    expect(detectOrientation(base(0)).status).toBe("rotate");
    expect(detectOrientation(base(1e-3)).status).toBe("uncertain");
  });
  it("a drawing far from the origin (1e6 ft offset) is still detected", () => {
    const off = (s: Seg): Seg => ({
      x1: s.x1 + 1e6,
      y1: s.y1 + 7e5,
      x2: s.x2 + 1e6,
      y2: s.y2 + 7e5,
    });
    const r = detectOrientation(edges(L, 23 * D).map(off));
    expect(r.status).toBe("rotate");
    expect(r.detectedRad).toBeCloseTo(23 * D, 6);
  });
  it("non-finite coordinates are ignored", () => {
    const r = detectOrientation([
      ...edges(RECT, 10 * D),
      { x1: NaN, y1: 0, x2: 1, y2: 1 },
    ]);
    expect(r.status).toBe("rotate");
  });
});

describe("wallSegmentsOf: the same segments dxfToGeometry builds walls from", () => {
  const wp = (v: P[]) => ({
    type: "LWPOLYLINE",
    layer: "WALLS",
    vertices: v.map(([x, y]) => ({ x, y })),
  });
  const wl = (a: P, b: P, layer = "WALLS") => ({
    type: "LINE",
    layer,
    vertices: [
      { x: a[0], y: a[1] },
      { x: b[0], y: b[1] },
    ],
  });
  it("Mode A: closed polyline edges only; LINEs and other layers are ignored", () => {
    const s = wallSegmentsOf(
      [
        wp(RECT),
        wl([0, 0], [1, 1]),
        wp([
          [0, 0],
          [1, 0],
          [1, 1],
        ]) as any,
      ].slice(0, 2),
    );
    expect(s).toHaveLength(4);
  });
  it("Mode B: wall LINEs only; door/window lines, arcs and text are ignored", () => {
    const s = wallSegmentsOf([
      wl([0, 0], [10, 0]),
      wl([0, 0], [0, 10], "walls"),
      wl([3, 0], [5, 0], "DOORS"),
      wl([6, 0], [8, 0], "WINDOWS"),
      {
        type: "ARC",
        layer: "WALLS",
        center: { x: 0, y: 0 },
        radius: 1,
        startAngle: 0,
        endAngle: 1,
      },
      { type: "TEXT", layer: "WALLS", startPoint: { x: 0, y: 0 }, text: "x" },
    ]);
    expect(s).toHaveLength(2);
  });
});
