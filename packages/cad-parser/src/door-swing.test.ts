import { describe, it, expect } from "vitest";
import { swingFromArc } from "./door-swing";

const arc = {
  center: { x: 4.5, y: 0 },
  radius: 1,
  startAngle: 0,
  endAngle: Math.PI / 2,
};

describe("swingFromArc", () => {
  it("finds the hinge and closed direction when the leaf sits on one arc end", () => {
    const s = swingFromArc({ x: 4.5, y: 0 }, { x: 4.5, y: 1 }, [arc]);
    expect(s?.closed).toBeCloseTo(0);
    expect(s?.open).toBeCloseTo(Math.PI / 2);
  });

  it("accepts the leaf line drawn from either end", () => {
    const s = swingFromArc({ x: 4.5, y: 1 }, { x: 4.5, y: 0 }, [arc]);
    expect(s?.hinge).toEqual({ x: 4.5, y: 0 });
  });

  // Stage 3b: dxf-parser returns ARC angles in RADIANS (it converts the DXF's
  // degrees), so the angles are never reinterpreted by magnitude. This replaces
  // the earlier "reads arc angles given in degrees" test, which pinned the
  // magnitude heuristic that has been removed.
  it("treats the angles as radians: a value of 90 is 90 radians, not 90 degrees", () => {
    const notDeg = { ...arc, startAngle: 0, endAngle: 90 };
    // 90 rad is 2.035 rad modulo a full turn, so it does not match a leaf at pi/2
    expect(
      swingFromArc({ x: 4.5, y: 0 }, { x: 4.5, y: 1 }, [notDeg]),
    ).toBeNull();
  });

  it("parser-produced radians beyond a full turn (source > 360 degrees) are reduced modulo a full turn, not read as degrees", () => {
    const D = Math.PI / 180;
    // source 360..450 degrees arrives as 6.283..7.854 rad
    const wrapped = { ...arc, startAngle: 360 * D, endAngle: 450 * D };
    const s = swingFromArc({ x: 4.5, y: 0 }, { x: 4.5, y: 1 }, [wrapped]);
    expect(s?.hinge).toEqual({ x: 4.5, y: 0 });
    expect(s?.closed).toBeCloseTo(360 * D); // closed end reported as given
    expect(s?.open).toBeCloseTo(450 * D);
    // and 370..460 degrees likewise points at the leaf along +y modulo 2pi
    const w2 = { ...arc, startAngle: 360 * D, endAngle: (360 + 90) * D };
    expect(
      swingFromArc({ x: 4.5, y: 0 }, { x: 4.5, y: 1 }, [w2]),
    ).not.toBeNull();
  });

  it("negative and crossing-zero parser angles (source -90..0 degrees) give the same swing as 270..360", () => {
    const D = Math.PI / 180;
    const neg = { ...arc, startAngle: -90 * D, endAngle: 0 };
    const pos = { ...arc, startAngle: 270 * D, endAngle: 360 * D };
    // leaf along -y from the hinge
    const a = swingFromArc({ x: 4.5, y: 0 }, { x: 4.5, y: -1 }, [neg]);
    const b = swingFromArc({ x: 4.5, y: 0 }, { x: 4.5, y: -1 }, [pos]);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a!.hinge).toEqual(b!.hinge);
  });

  it("the swing is the same when every arc angle and the leaf are rotated together (radians)", () => {
    const D = Math.PI / 180;
    for (const deg of [-44, -10, 0.5, 30, 100]) {
      const t = deg * D;
      const c = { x: 4.5, y: 0 };
      const rotP = (p: { x: number; y: number }) => ({
        x: p.x * Math.cos(t) - p.y * Math.sin(t),
        y: p.x * Math.sin(t) + p.y * Math.cos(t),
      });
      const rotated = {
        ...arc,
        center: rotP(c),
        startAngle: arc.startAngle + t,
        endAngle: arc.endAngle + t,
      };
      const base = swingFromArc(c, { x: 4.5, y: 1 }, [arc])!;
      const s = swingFromArc(rotP(c), rotP({ x: 4.5, y: 1 }), [rotated])!;
      expect(s).not.toBeNull();
      expect(s.open - base.open).toBeCloseTo(t, 9);
      expect(s.closed - base.closed).toBeCloseTo(t, 9);
    }
  });

  it("returns null when the leaf does not point at the arc", () => {
    expect(swingFromArc({ x: 4.5, y: 0 }, { x: 3.5, y: 0 }, [arc])).toBeNull();
  });

  it("returns null when the radius does not match the leaf", () => {
    expect(swingFromArc({ x: 4.5, y: 0 }, { x: 4.5, y: 2 }, [arc])).toBeNull();
  });
});
