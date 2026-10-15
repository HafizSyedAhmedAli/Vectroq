import type { Room, RoomType, Wall } from "@tmcc/shared-types";

export interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
export interface Label {
  x: number;
  y: number;
  text: string;
}

const EPS = 0.01; // ft
const key = (n: number) => Math.round(n / EPS) * EPS;

export function isAxisAligned(s: Seg): boolean {
  return Math.abs(s.x1 - s.x2) < EPS || Math.abs(s.y1 - s.y2) < EPS;
}

export function dedupeSegments(segs: Seg[]): Seg[] {
  const seen = new Set<string>();
  const out: Seg[] = [];
  for (const s of segs) {
    const a = `${key(s.x1)},${key(s.y1)}`;
    const b = `${key(s.x2)},${key(s.y2)}`;
    const id = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(s);
  }
  return out;
}

export function segmentsToWalls(
  segs: Seg[],
  height: number,
  exteriorThickness: number,
  interiorThickness: number,
): Wall[] {
  const xs = segs.flatMap((s) => [s.x1, s.x2]);
  const ys = segs.flatMap((s) => [s.y1, s.y2]);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs);
  const minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const onEdge = (s: Seg) =>
    (Math.abs(s.x1 - s.x2) < EPS &&
      (Math.abs(s.x1 - minX) < EPS || Math.abs(s.x1 - maxX) < EPS)) ||
    (Math.abs(s.y1 - s.y2) < EPS &&
      (Math.abs(s.y1 - minY) < EPS || Math.abs(s.y1 - maxY) < EPS));
  return segs.map((s, i) => ({
    id: `wall-${i}`,
    startX: s.x1,
    startY: s.y1,
    endX: s.x2,
    endY: s.y2,
    length: Math.hypot(s.x2 - s.x1, s.y2 - s.y1),
    height,
    thickness: onEdge(s) ? exteriorThickness : interiorThickness,
  }));
}

function detectRoomType(label: string): RoomType {
  if (/bath|washroom|toilet|wc/i.test(label)) return "bathroom";
  if (/kitchen/i.test(label)) return "kitchen";
  return "general";
}

function tidyName(raw: string): string {
  const t = raw.replace(/\\P/g, " ").replace(/\s+/g, " ").trim();
  // "BEDROOM 1" -> "Bedroom 1" (only when the drafter typed ALL CAPS)
  return t === t.toUpperCase()
    ? t.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase())
    : t;
}

function lastAtOrBelow(arr: number[], v: number): number {
  let idx = -1;
  for (let k = 0; k < arr.length; k++) if (arr[k] <= v) idx = k;
  return idx;
}

class UF {
  p: number[];
  constructor(n: number) {
    this.p = Array.from({ length: n }, (_, i) => i);
  }
  f(a: number): number {
    while (this.p[a] !== a) a = this.p[a] = this.p[this.p[a]];
    return a;
  }
  u(a: number, b: number) {
    this.p[this.f(a)] = this.f(b);
  }
}

/**
 * Finds enclosed rooms in an orthogonal wall plan drawn as separate LINEs.
 * The wall coordinates split the plane into a grid of cells; two neighbouring
 * cells are joined unless a wall lies on their shared edge. Cells connected to
 * the outside are not rooms. Each label is assigned to the room it sits in.
 * Returns [] if walls are not axis-aligned or do not close.
 */
export function roomsFromWallSegments(segs: Seg[], labels: Label[]): Room[] {
  if (segs.length === 0 || !segs.every(isAxisAligned)) return [];
  const xs = [...new Set(segs.flatMap((s) => [key(s.x1), key(s.x2)]))].sort(
    (a, b) => a - b,
  );
  const ys = [...new Set(segs.flatMap((s) => [key(s.y1), key(s.y2)]))].sort(
    (a, b) => a - b,
  );
  const nx = xs.length - 1,
    ny = ys.length - 1;
  if (nx < 1 || ny < 1) return [];
  const cell = (i: number, j: number) => j * nx + i;
  const OUT = nx * ny;
  const uf = new UF(nx * ny + 1);

  // blockedV[a][j]: vertical wall on line xs[a] covering row j
  const blockedV = Array.from({ length: xs.length }, () =>
    new Array<boolean>(ny).fill(false),
  );
  const blockedH = Array.from({ length: ys.length }, () =>
    new Array<boolean>(nx).fill(false),
  );
  for (const s of segs) {
    if (Math.abs(s.x1 - s.x2) < EPS) {
      const a = xs.indexOf(key(s.x1));
      const lo = Math.min(s.y1, s.y2),
        hi = Math.max(s.y1, s.y2);
      for (let j = 0; j < ny; j++)
        if (ys[j] >= lo - EPS && ys[j + 1] <= hi + EPS) blockedV[a][j] = true;
    } else {
      const b = ys.indexOf(key(s.y1));
      const lo = Math.min(s.x1, s.x2),
        hi = Math.max(s.x1, s.x2);
      for (let i = 0; i < nx; i++)
        if (xs[i] >= lo - EPS && xs[i + 1] <= hi + EPS) blockedH[b][i] = true;
    }
  }
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      if (i + 1 < nx ? !blockedV[i + 1][j] : !blockedV[nx][j])
        uf.u(cell(i, j), i + 1 < nx ? cell(i + 1, j) : OUT);
      if (i === 0 && !blockedV[0][j]) uf.u(cell(0, j), OUT);
      if (j + 1 < ny ? !blockedH[j + 1][i] : !blockedH[ny][i])
        uf.u(cell(i, j), j + 1 < ny ? cell(i, j + 1) : OUT);
      if (j === 0 && !blockedH[0][i]) uf.u(cell(i, 0), OUT);
    }

  const acc = new Map<number, { area: number; cx: number; cy: number }>();
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const r = uf.f(cell(i, j));
      if (r === uf.f(OUT)) continue;
      const a = (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j]);
      const m = acc.get(r) ?? { area: 0, cx: 0, cy: 0 };
      m.area += a;
      m.cx += (a * (xs[i] + xs[i + 1])) / 2;
      m.cy += (a * (ys[j] + ys[j + 1])) / 2;
      acc.set(r, m);
    }

  const nameByRoot = new Map<number, string>();
  const posByRoot = new Map<number, { x: number; y: number }>();
  for (const l of labels) {
    const i = lastAtOrBelow(xs, l.x);
    const j = lastAtOrBelow(ys, l.y);
    if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
    const r = uf.f(cell(i, j));
    if (acc.has(r) && !nameByRoot.has(r)) {
      nameByRoot.set(r, tidyName(l.text));
      posByRoot.set(r, { x: l.x, y: l.y });
    }
  }

  const rooms = [...acc.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([root, m], n) => {
      const pos = posByRoot.get(root) ?? { x: m.cx / m.area, y: m.cy / m.area };
      return {
        root,
        area: Math.round(m.area * 100) / 100,
        name: nameByRoot.get(root) ?? `Room ${n + 1}`,
        labelX: pos.x,
        labelY: pos.y,
      };
    });
  const count = new Map<string, number>();
  rooms.forEach((r) => count.set(r.name, (count.get(r.name) ?? 0) + 1));
  const seen = new Map<string, number>();
  return rooms.map((r, n) => {
    let name = r.name;
    if ((count.get(name) ?? 0) > 1) {
      const k = (seen.get(name) ?? 0) + 1;
      seen.set(name, k);
      name = `${name} ${k}`;
    }
    return {
      id: `room-${n}`,
      name,
      area: r.area,
      type: detectRoomType(name),
      labelX: r.labelX,
      labelY: r.labelY,
    };
  });
}
