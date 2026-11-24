// packages/cad-parser/src/rotate-entities.ts
//
// Phase 2, Stage 3b: rotates parsed DXF entities about the origin.
//
// SIGN CONVENTION. `angle` is the rotation actually applied: positive is
// counter-clockwise, in the DXF/CAD frame (x right, y up). A point becomes
//     x' = x cos(angle) - y sin(angle)
//     y' = x sin(angle) + y cos(angle)
// This is the value stored in ParseMeta.rotationRad.
//
// Rotation commutes with the unit scaling done in parse-dxf.ts, so a field the
// scaler leaves in drawing units (for example INSERT.position) is still rotated
// consistently with the fields that were scaled to feet.
//
// Fields handled (names as produced by dxf-parser 1.1):
//   LINE, LWPOLYLINE, POLYLINE, 3DFACE   vertices[]            points
//   SOLID                                points[]              points
//   ARC, CIRCLE                          center                point
//                                        startAngle/endAngle   RADIANS (dxf-parser converts
//                                        the DXF's degrees; no magnitude guessing),
//                                        normalised into [0, 2pi); a full circle keeps
//                                        end = start + 2pi
//                                        angleLength           recomputed as the parser
//                                        defines it (ARC: end - start; CIRCLE: wrapped)
//   TEXT (also MTEXT after parse-dxf's   startPoint, endPoint, position   points
//     MTEXT -> TEXT conversion)          directionVector                  vector
//                                        rotation (degrees)               += angle
//   ATTDEF                               startPoint, endPoint, rotation
//   POINT                                position
//   SPLINE                               controlPoints[], fitPoints[]     points
//                                        startTangent, endTangent         vectors
//   ELLIPSE                              center                           point
//                                        majorAxisEndPoint                vector
//                                        (startAngle/endAngle are parametric angles
//                                        measured from the major axis: unchanged)
//   DIMENSION                            anchorPoint, middleOfText, insertionPoint,
//                                        linearOrAngularPoint1/2, diameterOrRadiusPoint,
//                                        arcPoint                         points
//                                        angle (degrees)                  += angle
//   INSERT                               position, rotation (degrees)
// Radii, lengths, heights, widths, scales, bulges, knots, ratios, ids, layers and
// every other field are copied unchanged. Entity types not listed are returned
// untouched. INSERT block contents are not exposed by the parser, so they are not
// rotated (a documented limitation; nothing is expanded or invented).

const TAU = Math.PI * 2;

const normRad = (a: number) => {
  const r = ((a % TAU) + TAU) % TAU;
  return r >= TAU ? 0 : r;
};
const normDeg = (a: number) => {
  const r = ((a % 360) + 360) % 360;
  return r >= 360 ? 0 : r;
};

export type RotatableEntity = { type: string; [k: string]: any };

/** Rotates one entity. Returns a new object; the input is never modified. */
export function rotateEntity<T extends RotatableEntity>(
  e: T,
  angle: number,
): T {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const deg = (angle * 180) / Math.PI;
  const out: any = { ...e };

  const rot = (p: any) =>
    p && typeof p.x === "number" && typeof p.y === "number"
      ? { ...p, x: c * p.x - s * p.y, y: s * p.x + c * p.y }
      : p;
  const point = (k: string) => {
    if (out[k] !== undefined) out[k] = rot(out[k]);
  };
  const list = (k: string) => {
    if (Array.isArray(out[k])) out[k] = out[k].map(rot);
  };
  const degrees = (k: string, alwaysSet: boolean) => {
    if (out[k] !== undefined || alwaysSet)
      out[k] = normDeg((Number(out[k]) || 0) + deg);
  };

  switch (String(e.type).toUpperCase()) {
    case "LINE":
    case "LWPOLYLINE":
    case "POLYLINE":
    case "3DFACE":
      list("vertices");
      break;
    case "SOLID":
      list("points");
      list("vertices");
      break;
    case "ARC":
    case "CIRCLE": {
      point("center");
      const a0 = out.startAngle;
      const a1 = out.endAngle;
      if (typeof a0 === "number" && typeof a1 === "number") {
        // dxf-parser 1.1.x returns these in RADIANS (it converts the DXF's
        // degrees: startAngle = PI / 180 * value) and does not normalise them, so
        // a source of 370 degrees arrives as 6.458. Units are never guessed from
        // magnitude. The rotation is added in radians.
        const isCircle = String(e.type).toUpperCase() === "CIRCLE";
        const sweep = a1 - a0;
        // A full circle (0 to 360 arrives as 0 to exactly 2*PI) must keep its
        // sweep: normalising both ends independently would make start === end.
        // It is written the way the parser writes 0..360: end = start + 2*PI.
        const full = sweep >= TAU - 1e-9;
        const start = normRad(a0 + angle);
        const end = full ? start + TAU : normRad(a1 + angle);
        out.startAngle = start;
        out.endAngle = end;
        if (out.angleLength !== undefined) {
          // Same definition as the parser: ARC angleLength = end - start (negative
          // when the arc crosses 0); CIRCLE adds 2*PI when end < start.
          out.angleLength =
            isCircle && end < start ? end + TAU - start : end - start;
        }
      }
      break;
    }
    case "TEXT":
      point("startPoint");
      point("endPoint");
      point("position"); // MTEXT anchor kept by parse-dxf's conversion
      point("directionVector"); // MTEXT x-axis
      // A TEXT / MTEXT whose orientation lives only in directionVector keeps it
      // there; everything else carries an explicit rotation.
      degrees("rotation", out.directionVector === undefined);
      break;
    case "MTEXT":
      point("position");
      point("directionVector");
      degrees("rotation", out.directionVector === undefined);
      break;
    case "ATTDEF":
      point("startPoint");
      point("endPoint");
      degrees("rotation", true);
      break;
    case "POINT":
      point("position");
      break;
    case "SPLINE":
      list("controlPoints");
      list("fitPoints");
      point("startTangent");
      point("endTangent");
      break;
    case "ELLIPSE":
      point("center");
      point("majorAxisEndPoint");
      break;
    case "DIMENSION":
      for (const k of [
        "anchorPoint",
        "middleOfText",
        "insertionPoint",
        "linearOrAngularPoint1",
        "linearOrAngularPoint2",
        "diameterOrRadiusPoint",
        "arcPoint",
      ])
        point(k);
      // rotated-linear dimensions (type 0) default to angle 0
      degrees("angle", ((Number(out.dimensionType) || 0) & 7) === 0);
      break;
    case "INSERT":
      point("position");
      degrees("rotation", true);
      break;
    default:
      break;
  }
  return out as T;
}

export function rotateEntities<T extends RotatableEntity>(
  entities: T[],
  angle: number,
): T[] {
  return entities.map((e) => rotateEntity(e, angle));
}
