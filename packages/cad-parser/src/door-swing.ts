import type { Point2D } from "./polygon";

export interface RawArc {
  center: Point2D;
  radius: number;
  startAngle: number;
  endAngle: number;
}

export interface DoorSwing {
  hinge: Point2D;
  /** Direction (radians) the door lies in when closed, along the wall. */
  closed: number;
  /** Direction (radians) of the leaf when fully open. */
  open: number;
}

const TAU = Math.PI * 2;

const norm = (a: number) => {
  const r = a % TAU;
  return r < 0 ? r + TAU : r;
};

const angDiff = (a: number, b: number) => {
  const d = Math.abs(norm(a) - norm(b));
  return Math.min(d, TAU - d);
};

// dxf-parser reports ARC angles in radians; raw DXF uses degrees. Anything
// beyond a full turn can only be degrees.
function arcAngles(arc: RawArc): [number, number] {
  const deg =
    Math.max(Math.abs(arc.startAngle), Math.abs(arc.endAngle)) > TAU + 1e-6;
  const k = deg ? Math.PI / 180 : 1;
  return [arc.startAngle * k, arc.endAngle * k];
}

/**
 * A door symbol is a leaf LINE plus a quarter-circle ARC centred on the hinge.
 * The line is the open leaf, so it must point at one end of the arc. The other
 * end of the arc is where the door lies when closed (along the wall).
 * Returns null when the line and arcs do not form a consistent symbol.
 */
export function swingFromArc(
  a: Point2D,
  b: Point2D,
  arcs: RawArc[],
): DoorSwing | null {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 1e-6) return null;

  for (const [hinge, tip] of [
    [a, b],
    [b, a],
  ] as const) {
    for (const arc of arcs) {
      if (
        Math.hypot(arc.center.x - hinge.x, arc.center.y - hinge.y) >
        0.05 + len * 0.01
      )
        continue;
      if (Math.abs(arc.radius - len) > len * 0.03) continue;

      const [s, e] = arcAngles(arc);
      const leaf = Math.atan2(tip.y - hinge.y, tip.x - hinge.x);
      const tol = 0.05;
      if (angDiff(leaf, e) < tol) return { hinge, open: e, closed: s };
      if (angDiff(leaf, s) < tol) return { hinge, open: s, closed: e };
    }
  }
  return null;
}
