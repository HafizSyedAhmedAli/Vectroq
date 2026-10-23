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

  it("reads arc angles given in degrees", () => {
    const deg = { ...arc, startAngle: 0, endAngle: 90 };
    const s = swingFromArc({ x: 4.5, y: 0 }, { x: 4.5, y: 1 }, [deg]);
    expect(s?.open).toBeCloseTo(Math.PI / 2);
  });

  it("returns null when the leaf does not point at the arc", () => {
    expect(swingFromArc({ x: 4.5, y: 0 }, { x: 3.5, y: 0 }, [arc])).toBeNull();
  });

  it("returns null when the radius does not match the leaf", () => {
    expect(swingFromArc({ x: 4.5, y: 0 }, { x: 4.5, y: 2 }, [arc])).toBeNull();
  });
});
