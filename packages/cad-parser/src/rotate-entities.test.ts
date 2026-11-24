// Phase 2, Stage 3b: every supported entity type and coordinate-bearing field.
import { describe, expect, it } from "vitest";
import DxfParser from "dxf-parser";
import { rotateEntity } from "./rotate-entities";

const D = Math.PI / 180;
const A = 30 * D;
const c = Math.cos(A);
const s = Math.sin(A);
const rp = (x: number, y: number) => ({ x: c * x - s * y, y: s * x + c * y });
const pt = (x: number, y: number, z = 5) => ({ x, y, z });
const near = (a: any, b: any) => {
  expect(a.x).toBeCloseTo(b.x, 12);
  expect(a.y).toBeCloseTo(b.y, 12);
};

describe("rotateEntity: points and vertices", () => {
  it("LINE vertices rotate; z, layer, type and extra fields are kept; input untouched", () => {
    const e = {
      type: "LINE",
      layer: "WALLS",
      handle: "AB",
      vertices: [pt(10, 0), pt(10, 5)],
    };
    const copy = JSON.stringify(e);
    const r = rotateEntity(e, A);
    near(r.vertices[0], rp(10, 0));
    near(r.vertices[1], rp(10, 5));
    expect(r.vertices[0].z).toBe(5);
    expect([r.type, r.layer, r.handle]).toEqual(["LINE", "WALLS", "AB"]);
    expect(JSON.stringify(e)).toBe(copy);
  });
  for (const type of ["LWPOLYLINE", "POLYLINE", "3DFACE"])
    it(`${type} vertices rotate and bulge/width survive`, () => {
      const e = {
        type,
        layer: "WALLS",
        shape: true,
        vertices: [
          { ...pt(0, 0), bulge: 0.5 },
          { ...pt(4, 0), bulge: 0 },
          pt(4, 3),
        ],
      };
      const r = rotateEntity(e, A);
      near(r.vertices[2], rp(4, 3));
      expect(r.vertices[0].bulge).toBe(0.5);
      expect(r.shape).toBe(true);
    });
  it("SOLID points rotate", () => {
    const r = rotateEntity(
      {
        type: "SOLID",
        layer: "X",
        points: [pt(1, 0), pt(2, 0), pt(2, 1), pt(1, 1)],
      },
      A,
    );
    near(r.points[2], rp(2, 1));
  });
  it("POINT position rotates", () => {
    near(
      rotateEntity({ type: "POINT", layer: "X", position: pt(3, 4) }, A)
        .position,
      rp(3, 4),
    );
  });
});

describe("rotateEntity: ARC and CIRCLE", () => {
  it("ARC centre rotates, radius is kept, angles (radians) advance by the rotation", () => {
    const e = {
      type: "ARC",
      layer: "DOORS",
      center: pt(3, 2),
      radius: 2.5,
      startAngle: 0,
      endAngle: Math.PI / 2,
    };
    const r = rotateEntity(e, A);
    near(r.center, rp(3, 2));
    expect(r.radius).toBe(2.5);
    expect(r.startAngle).toBeCloseTo(A, 12);
    expect(r.endAngle).toBeCloseTo(Math.PI / 2 + A, 12);
  });
  it("the rotated arc still passes through the rotated end points", () => {
    const e = {
      type: "ARC",
      layer: "DOORS",
      center: pt(3, 2),
      radius: 2.5,
      startAngle: 0.3,
      endAngle: 1.9,
    };
    const r = rotateEntity(e, A);
    for (const [orig, now] of [
      [e.startAngle, r.startAngle],
      [e.endAngle, r.endAngle],
    ]) {
      const p0 = rp(3 + 2.5 * Math.cos(orig), 2 + 2.5 * Math.sin(orig));
      near(
        {
          x: r.center.x + 2.5 * Math.cos(now),
          y: r.center.y + 2.5 * Math.sin(now),
        },
        p0,
      );
    }
  });
  it("angles are normalised into [0, 2pi) and a wrapped sweep keeps its length", () => {
    const e = {
      type: "ARC",
      layer: "DOORS",
      center: pt(0, 0),
      radius: 1,
      startAngle: 5.5,
      endAngle: 0.5,
      angleLength: 0.5 - 5.5,
    };
    const r = rotateEntity(e, A);
    expect(r.startAngle).toBeGreaterThanOrEqual(0);
    expect(r.startAngle).toBeLessThan(2 * Math.PI);
    expect(r.endAngle).toBeGreaterThanOrEqual(0);
    expect(r.endAngle).toBeLessThan(2 * Math.PI);
    const sweep =
      (((r.endAngle - r.startAngle) % (2 * Math.PI)) + 2 * Math.PI) %
      (2 * Math.PI);
    expect(sweep).toBeCloseTo(0.5 + 2 * Math.PI - 5.5, 9);
  });
  it("a negative rotation wraps below zero correctly", () => {
    const r = rotateEntity(
      {
        type: "ARC",
        layer: "D",
        center: pt(0, 0),
        radius: 1,
        startAngle: 0.1,
        endAngle: 1,
      },
      -0.3,
    );
    expect(r.startAngle).toBeCloseTo(2 * Math.PI - 0.2, 12);
    expect(r.endAngle).toBeCloseTo(0.7, 12);
  });
  it("dxf-parser reports ARC angles in radians (assumption verified against the parser)", () => {
    const dxf = [
      "0",
      "SECTION",
      "2",
      "ENTITIES",
      "0",
      "ARC",
      "8",
      "DOORS",
      "10",
      "1",
      "20",
      "2",
      "30",
      "0",
      "40",
      "3",
      "50",
      "90",
      "51",
      "180",
      "0",
      "ENDSEC",
      "0",
      "EOF",
    ].join("\n");
    const arc: any = new DxfParser().parseSync(dxf)!.entities[0];
    expect(arc.startAngle).toBeCloseTo(Math.PI / 2, 12);
    expect(arc.endAngle).toBeCloseTo(Math.PI, 12);
    const r = rotateEntity(arc, A);
    expect(r.startAngle).toBeCloseTo(Math.PI / 2 + A, 12);
  });
  it("CIRCLE centre rotates and radius is kept", () => {
    const r = rotateEntity(
      { type: "CIRCLE", layer: "X", center: pt(4, 1), radius: 0.5 },
      A,
    );
    near(r.center, rp(4, 1));
    expect(r.radius).toBe(0.5);
  });
});

// ---- ARC / CIRCLE angle contract (dxf-parser 1.1.2 returns RADIANS, un-normalised)
const TAU = Math.PI * 2;
const dxfWith = (type: "ARC" | "CIRCLE", a0: number, a1: number) =>
  [
    "0",
    "SECTION",
    "2",
    "ENTITIES",
    "0",
    type,
    "8",
    "DOORS",
    "10",
    "3",
    "20",
    "2",
    "30",
    "0",
    "40",
    "2.5",
    "50",
    String(a0),
    "51",
    String(a1),
    "0",
    "ENDSEC",
    "0",
    "EOF",
  ].join("\n");
const parsed = (type: "ARC" | "CIRCLE", a0: number, a1: number): any =>
  new DxfParser().parseSync(dxfWith(type, a0, a1))!.entities[0];
const onCircle = (c: any, r: number, a: number) => ({
  x: c.x + r * Math.cos(a),
  y: c.y + r * Math.sin(a),
});
const rotPt = (p: { x: number; y: number }, t: number) => ({
  x: p.x * Math.cos(t) - p.y * Math.sin(t),
  y: p.x * Math.sin(t) + p.y * Math.cos(t),
});
const mod = (x: number) => ((x % TAU) + TAU) % TAU;

const ARC_CASES: [string, number, number][] = [
  ["350..10 (crossing 0)", 350, 10],
  ["-20..30", -20, 30],
  ["0..90", 0, 90],
  ["0..180", 0, 180],
  ["0..270", 0, 270],
  ["0..359.9", 0, 359.9],
  ["0..360 (full circle)", 0, 360],
  ["370..400 (parser radians above 2pi)", 370, 400],
  ["720..810 (parser radians above 4pi)", 720, 810],
  ["90..450 (full circle, other start)", 90, 450],
  ["-180..180 (full circle)", -180, 180],
];
const ANGLES_DEG = [30, -30, 100, -100, 44, -44, 0.01, -0.01, 180];

describe("ARC and CIRCLE angles (radians, dxf-parser contract)", () => {
  for (const type of ["ARC", "CIRCLE"] as const)
    for (const [name, a0, a1] of ARC_CASES)
      for (const deg of ANGLES_DEG) {
        it(`${type} ${name} rotated ${deg} degrees keeps endpoints, sweep and the parser's field definitions`, () => {
          const e = parsed(type, a0, a1);
          const t = deg * D;
          const r = rotateEntity(e, t);
          // geometry: both ends sit where the rotated original ends sit
          const want0 = rotPt(onCircle(e.center, 2.5, e.startAngle), t);
          const want1 = rotPt(onCircle(e.center, 2.5, e.endAngle), t);
          const got0 = onCircle(r.center, 2.5, r.startAngle);
          const got1 = onCircle(r.center, 2.5, r.endAngle);
          expect(Math.hypot(got0.x - want0.x, got0.y - want0.y)).toBeLessThan(
            1e-9,
          );
          expect(Math.hypot(got1.x - want1.x, got1.y - want1.y)).toBeLessThan(
            1e-9,
          );
          // start is normalised into [0, 2pi)
          expect(r.startAngle).toBeGreaterThanOrEqual(0);
          expect(r.startAngle).toBeLessThan(TAU);
          const full = e.endAngle - e.startAngle >= TAU - 1e-9;
          if (full) {
            // a full circle keeps its whole sweep: end = start + 2pi, never start === end
            expect(r.endAngle - r.startAngle).toBeCloseTo(TAU, 12);
          } else {
            expect(r.endAngle).toBeGreaterThanOrEqual(0);
            expect(r.endAngle).toBeLessThan(TAU);
            // the sweep (counter-clockwise from start to end) is preserved
            expect(mod(r.endAngle - r.startAngle)).toBeCloseTo(
              mod(e.endAngle - e.startAngle),
              9,
            );
          }
          // radius and centre-relative size are untouched
          expect(r.radius).toBe(2.5);
          // angleLength follows the parser: ARC = end - start; CIRCLE wraps when end < start
          const expectedLen =
            type === "CIRCLE" && r.endAngle < r.startAngle
              ? r.endAngle + TAU - r.startAngle
              : r.endAngle - r.startAngle;
          expect(r.angleLength).toBeCloseTo(expectedLen, 12);
        });
      }

  it("full circle: 0..360 keeps start at the rotated 0 and an exact 2pi sweep (not an empty arc)", () => {
    const e = parsed("ARC", 0, 360);
    expect(e.endAngle).toBe(TAU); // parser writes exactly 2pi
    for (const deg of [30, -30, 100, -100]) {
      const r = rotateEntity(e, deg * D);
      expect(r.startAngle).toBeCloseTo(mod(deg * D), 12);
      expect(r.endAngle - r.startAngle).toBeCloseTo(TAU, 12);
      expect(r.angleLength).toBeCloseTo(TAU, 12);
    }
  });

  it("crossing zero: ARC angleLength stays NEGATIVE after a rotation that keeps the arc crossing zero, as the parser reports it", () => {
    const e = parsed("ARC", 350, 10);
    expect(e.angleLength).toBeLessThan(0); // parser: end - start, unwrapped
    const r = rotateEntity(e, -5 * D); // 345..5: still crosses 0
    expect(r.startAngle).toBeCloseTo(345 * D, 12);
    expect(r.endAngle).toBeCloseTo(5 * D, 12);
    expect(r.angleLength).toBeLessThan(0);
    expect(r.angleLength).toBeCloseTo(5 * D - 345 * D, 12);
  });

  it("crossing zero: CIRCLE angleLength stays positive (the parser wraps it)", () => {
    const e = parsed("CIRCLE", 350, 10);
    expect(e.angleLength).toBeCloseTo(20 * D, 12);
    expect(rotateEntity(e, -5 * D).angleLength).toBeCloseTo(20 * D, 12);
  });

  it("an arc that starts crossing zero only after rotation gets the parser's negative ARC angleLength", () => {
    const e = parsed("ARC", 340, 350); // does not cross 0
    expect(e.angleLength).toBeCloseTo(10 * D, 12);
    const r = rotateEntity(e, 15 * D); // 355..5: crosses 0
    expect(r.angleLength).toBeCloseTo(5 * D - 355 * D, 12);
  });

  it("parser radians above 2pi are never read as degrees (370..400 degrees)", () => {
    const e = parsed("ARC", 370, 400);
    expect(e.startAngle).toBeCloseTo(370 * D, 12); // 6.458 rad
    const r = rotateEntity(e, 30 * D);
    expect(r.startAngle).toBeCloseTo(mod(400 * D), 12);
    expect(r.endAngle).toBeCloseTo(mod(430 * D), 12);
  });

  it("a rotation of exactly 0 leaves every angle numerically equal modulo a turn", () => {
    const e = parsed("ARC", 20, 70);
    const r = rotateEntity(e, 0);
    expect(r.startAngle).toBeCloseTo(e.startAngle, 14);
    expect(r.endAngle).toBeCloseTo(e.endAngle, 14);
  });

  it("an ARC with no angle fields (centre and radius only) is rotated without inventing angles", () => {
    const r = rotateEntity(
      { type: "ARC", layer: "X", center: pt(1, 1), radius: 2 } as any,
      0.3,
    );
    expect(r.startAngle).toBeUndefined();
    expect(r.endAngle).toBeUndefined();
  });
});

describe("rotateEntity: text", () => {
  it("TEXT start/end points rotate; rotation (degrees) advances and is normalised; height kept", () => {
    const e = {
      type: "TEXT",
      layer: "ANNO",
      startPoint: pt(5, 5),
      endPoint: pt(8, 5),
      textHeight: 0.7,
      xScale: 1,
      rotation: 350,
      text: "Living",
    };
    const r = rotateEntity(e, A);
    near(r.startPoint, rp(5, 5));
    near(r.endPoint, rp(8, 5));
    expect(r.rotation).toBeCloseTo(20, 9);
    expect([r.textHeight, r.xScale, r.text]).toEqual([0.7, 1, "Living"]);
  });
  it("TEXT with no rotation field gets one equal to the applied angle", () => {
    expect(
      rotateEntity(
        { type: "TEXT", layer: "A", startPoint: pt(0, 0), text: "x" },
        A,
      ).rotation,
    ).toBeCloseTo(30, 9);
  });
  it("a negative rotation normalises into [0, 360)", () => {
    expect(
      rotateEntity(
        {
          type: "TEXT",
          layer: "A",
          startPoint: pt(0, 0),
          rotation: 10,
          text: "x",
        },
        -A,
      ).rotation,
    ).toBeCloseTo(340, 9);
  });
  it("MTEXT position and directionVector rotate (vector without translation)", () => {
    const r = rotateEntity(
      {
        type: "MTEXT",
        layer: "A",
        position: pt(2, 1),
        directionVector: pt(1, 0, 0),
        text: "m",
      },
      A,
    );
    near(r.position, rp(2, 1));
    near(r.directionVector, rp(1, 0));
    expect(r.rotation).toBeUndefined(); // orientation lives in the vector
  });
  it("MTEXT already converted to TEXT by parseDxf keeps both anchors consistent", () => {
    const position = pt(2, 1);
    const r = rotateEntity(
      {
        type: "TEXT",
        layer: "A",
        position,
        startPoint: position,
        text: "m",
        rotation: 0,
      },
      A,
    );
    near(r.position, rp(2, 1));
    near(r.startPoint, rp(2, 1));
    expect(r.rotation).toBeCloseTo(30, 9);
  });
  it("ATTDEF points and rotation", () => {
    const r = rotateEntity(
      {
        type: "ATTDEF",
        layer: "A",
        startPoint: pt(1, 1),
        endPoint: pt(2, 1),
        rotation: 0,
      },
      A,
    );
    near(r.startPoint, rp(1, 1));
    expect(r.rotation).toBeCloseTo(30, 9);
  });
});

describe("rotateEntity: SPLINE, ELLIPSE, DIMENSION, INSERT", () => {
  it("SPLINE control/fit points and tangents rotate; knots, degree and flags are kept", () => {
    const e = {
      type: "SPLINE",
      layer: "X",
      controlPoints: [pt(0, 0), pt(1, 2), pt(3, 1)],
      fitPoints: [pt(0, 0), pt(3, 1)],
      startTangent: pt(1, 0, 0),
      endTangent: pt(0, 1, 0),
      knotValues: [0, 0, 0, 1, 1, 1],
      degreeOfSplineCurve: 2,
      closed: false,
    };
    const r = rotateEntity(e, A);
    near(r.controlPoints[1], rp(1, 2));
    near(r.fitPoints[1], rp(3, 1));
    near(r.startTangent, rp(1, 0));
    near(r.endTangent, rp(0, 1));
    expect(r.knotValues).toEqual(e.knotValues);
    expect(r.degreeOfSplineCurve).toBe(2);
  });
  it("ELLIPSE centre rotates, the major-axis end point rotates as a vector, parametric angles and ratio are unchanged", () => {
    const e = {
      type: "ELLIPSE",
      layer: "X",
      center: pt(5, 5),
      majorAxisEndPoint: pt(3, 0, 0),
      axisRatio: 0.5,
      startAngle: 0,
      endAngle: 6.28,
    };
    const r = rotateEntity(e, A);
    near(r.center, rp(5, 5));
    near(r.majorAxisEndPoint, rp(3, 0));
    expect([r.axisRatio, r.startAngle, r.endAngle]).toEqual([0.5, 0, 6.28]);
  });
  it("DIMENSION definition points rotate; angle advances; text and measurement are kept", () => {
    const e = {
      type: "DIMENSION",
      layer: "DIM",
      anchorPoint: pt(0, 3),
      middleOfText: pt(5, 3),
      insertionPoint: pt(1, 1),
      linearOrAngularPoint1: pt(0, 0),
      linearOrAngularPoint2: pt(10, 0),
      diameterOrRadiusPoint: pt(2, 2),
      arcPoint: pt(3, 3),
      dimensionType: 0,
      angle: 0,
      actualMeasurement: 10,
      text: "10'",
    };
    const r = rotateEntity(e, A);
    for (const k of [
      "anchorPoint",
      "middleOfText",
      "insertionPoint",
      "linearOrAngularPoint1",
      "linearOrAngularPoint2",
      "diameterOrRadiusPoint",
      "arcPoint",
    ])
      near((r as any)[k], rp((e as any)[k].x, (e as any)[k].y));
    expect(r.angle).toBeCloseTo(30, 9);
    expect([r.actualMeasurement, r.text]).toEqual([10, "10'"]);
  });
  it("an aligned DIMENSION without an angle gets none invented", () => {
    const r = rotateEntity(
      {
        type: "DIMENSION",
        layer: "DIM",
        dimensionType: 1,
        anchorPoint: pt(0, 0),
      },
      A,
    );
    expect(r.angle).toBeUndefined();
  });
  it("INSERT position rotates, rotation advances, scale and block name are kept", () => {
    const r = rotateEntity(
      {
        type: "INSERT",
        layer: "X",
        name: "TREE",
        position: pt(7, 2),
        rotation: 10,
        xScale: 2,
        yScale: 2,
      },
      A,
    );
    near(r.position, rp(7, 2));
    expect(r.rotation).toBeCloseTo(40, 9);
    expect([r.name, r.xScale, r.yScale]).toEqual(["TREE", 2, 2]);
  });
  it("an INSERT without a rotation field gets one", () => {
    expect(
      rotateEntity(
        { type: "INSERT", layer: "X", name: "B", position: pt(0, 0) },
        A,
      ).rotation,
    ).toBeCloseTo(30, 9);
  });
});

describe("rotateEntity: general", () => {
  it("is exact for 0 and quarter turns on axis coordinates (to 1e-15)", () => {
    const r = rotateEntity(
      { type: "LINE", layer: "W", vertices: [pt(10, 0), pt(10, 5)] },
      Math.PI / 2,
    );
    expect(r.vertices[0].x).toBeCloseTo(0, 14);
    expect(r.vertices[0].y).toBeCloseTo(10, 14);
  });
  it("rotating then rotating back restores coordinates within 1e-12", () => {
    const e = {
      type: "LINE",
      layer: "W",
      vertices: [pt(12.3, -4.5), pt(98.7, 6.5)],
    };
    const back = rotateEntity(rotateEntity(e, 0.37), -0.37);
    near(back.vertices[0], e.vertices[0]);
    near(back.vertices[1], e.vertices[1]);
  });
  it("unknown entity types pass through untouched", () => {
    const e = { type: "HATCH", layer: "X", whatever: [1, 2] };
    expect(rotateEntity(e, A)).toEqual(e);
  });
  it("entities with missing optional fields do not throw", () => {
    for (const type of [
      "LINE",
      "ARC",
      "TEXT",
      "SPLINE",
      "ELLIPSE",
      "DIMENSION",
      "INSERT",
      "CIRCLE",
      "POINT",
      "SOLID",
      "MTEXT",
    ])
      expect(() => rotateEntity({ type, layer: "X" }, A)).not.toThrow();
  });
});
