// packages/cad-parser/src/polygon.ts
export interface Point2D {
  x: number;
  y: number;
}

// Shoelace formula — standard closed-polygon area, works for any simple
// (non-self-intersecting) polygon regardless of winding direction.
export function polygonArea(vertices: Point2D[]): number {
  let sum = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export function distance(a: Point2D, b: Point2D): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

// Standard ray-casting point-in-polygon test. Used to match a TEXT label
// to the room polygon it sits inside, so a label's insertion point doesn't
// need to sit at the polygon's exact centroid.
export function pointInPolygon(point: Point2D, vertices: Point2D[]): boolean {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const vi = vertices[i];
    const vj = vertices[j];
    const intersects =
      vi.y > point.y !== vj.y > point.y &&
      point.x < ((vj.x - vi.x) * (point.y - vi.y)) / (vj.y - vi.y) + vi.x;
    if (intersects) inside = !inside;
  }
  return inside;
}
