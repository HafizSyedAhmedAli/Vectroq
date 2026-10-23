import type { Geometry, Opening, Room } from "@vectroq/shared-types";

interface Rect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

interface Link {
  a: number;
  b: number;
  vertical: boolean; // the shared wall runs along y at x = `at`
  at: number;
  lo: number;
  hi: number;
}

const EPS = 0.2; // ft
const MIN_LINK_FT = 3.5; // shortest shared wall worth cutting a passage in
const ARCH_W = 4;
const ARCH_H = 7;
const PUBLIC =
  /living|lounge|dining|drawing|family|hall|lobby|corridor|passage/i;

type Pt = { x: number; y: number };

function polyArea(p: Pt[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

function inPoly(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}

/** Rectangular pieces of a room (non-rectangular pieces are skipped). */
function rectsOf(room: Room): Rect[] {
  return (room.shapes ?? []).flatMap((poly) => {
    if (poly.length < 3) return [];
    const xs = poly.map((p) => p.x);
    const ys = poly.map((p) => p.y);
    const box = {
      x0: Math.min(...xs),
      x1: Math.max(...xs),
      y0: Math.min(...ys),
      y1: Math.max(...ys),
    };
    const area = (box.x1 - box.x0) * (box.y1 - box.y0);
    return area > 0 && polyArea(poly) / area > 0.98 ? [box] : [];
  });
}

function roomAt(rooms: Room[], x: number, y: number): number {
  return rooms.findIndex((r) =>
    (r.shapes ?? []).some((s) => inPoly({ x, y }, s)),
  );
}

/** For every pair of rooms: the longest stretch of wall they share. */
function boundaries(rects: Rect[][]): Link[] {
  const raw = new Map<
    string,
    {
      a: number;
      b: number;
      vertical: boolean;
      at: number;
      spans: [number, number][];
    }
  >();
  const add = (
    a: number,
    b: number,
    vertical: boolean,
    at: number,
    lo: number,
    hi: number,
  ) => {
    const key = `${a}|${b}|${vertical ? "v" : "h"}|${Math.round(at / EPS)}`;
    const e = raw.get(key) ?? { a, b, vertical, at, spans: [] };
    e.spans.push([lo, hi]);
    raw.set(key, e);
  };

  for (let i = 0; i < rects.length; i++)
    for (let j = i + 1; j < rects.length; j++)
      for (const ra of rects[i])
        for (const rb of rects[j]) {
          const ylo = Math.max(ra.y0, rb.y0);
          const yhi = Math.min(ra.y1, rb.y1);
          if (yhi > ylo) {
            if (Math.abs(ra.x1 - rb.x0) < EPS)
              add(i, j, true, (ra.x1 + rb.x0) / 2, ylo, yhi);
            if (Math.abs(rb.x1 - ra.x0) < EPS)
              add(i, j, true, (rb.x1 + ra.x0) / 2, ylo, yhi);
          }
          const xlo = Math.max(ra.x0, rb.x0);
          const xhi = Math.min(ra.x1, rb.x1);
          if (xhi > xlo) {
            if (Math.abs(ra.y1 - rb.y0) < EPS)
              add(i, j, false, (ra.y1 + rb.y0) / 2, xlo, xhi);
            if (Math.abs(rb.y1 - ra.y0) < EPS)
              add(i, j, false, (rb.y1 + ra.y0) / 2, xlo, xhi);
          }
        }

  const out: Link[] = [];
  for (const e of raw.values()) {
    const spans = [...e.spans].sort((p, q) => p[0] - q[0]);
    let best: [number, number] = spans[0];
    let cur: [number, number] = [...spans[0]];
    for (const s of spans.slice(1)) {
      if (s[0] <= cur[1] + EPS) cur[1] = Math.max(cur[1], s[1]);
      else {
        if (cur[1] - cur[0] > best[1] - best[0]) best = cur;
        cur = [...s];
      }
    }
    if (cur[1] - cur[0] > best[1] - best[0]) best = cur;
    out.push({
      a: e.a,
      b: e.b,
      vertical: e.vertical,
      at: e.at,
      lo: best[0],
      hi: best[1],
    });
  }
  return out;
}

/**
 * Returns the geometry with extra archways so every room can be reached from
 * every other. Rooms are "connected" when a door sits between them. Where the
 * drawing leaves groups of rooms cut off, one archway is added per gap, in the
 * best shared wall (living and dining areas first, bathrooms last). Viewer
 * only: nothing here is saved or priced.
 */
export function addConnectingOpenings(g: Geometry): Geometry {
  const n = g.rooms.length;
  if (n < 2) return g;

  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (a: number): number => {
    while (parent[a] !== a) a = parent[a] = parent[parent[a]];
    return a;
  };
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };

  // existing doors join the two rooms on either side of them
  for (const o of g.openings) {
    if (o.type !== "door") continue;
    if (o.x === undefined || o.y === undefined || o.angle === undefined)
      continue;
    const nx = -Math.sin(o.angle);
    const ny = Math.cos(o.angle);
    const p = roomAt(g.rooms, o.x + nx * 0.8, o.y + ny * 0.8);
    const q = roomAt(g.rooms, o.x - nx * 0.8, o.y - ny * 0.8);
    if (p >= 0 && q >= 0) union(p, q);
  }

  const links = boundaries(g.rooms.map(rectsOf)).filter(
    (l) => l.hi - l.lo >= MIN_LINK_FT,
  );
  const score = (l: Link) => {
    let s = Math.min(l.hi - l.lo, 20) * 0.1;
    for (const r of [g.rooms[l.a], g.rooms[l.b]]) {
      if (PUBLIC.test(r.name)) s += 10;
      if (r.type === "bathroom") s -= 20;
    }
    return s;
  };

  const extra: Opening[] = [];
  for (let guard = 0; guard < n; guard++) {
    const open = links.filter((l) => find(l.a) !== find(l.b));
    if (open.length === 0) break;
    const best = open.reduce((m, l) => (score(l) > score(m) ? l : m));
    const len = best.hi - best.lo;
    const mid = (best.lo + best.hi) / 2;
    extra.push({
      id: `link-${extra.length}`,
      type: "door",
      archway: true,
      width: Math.min(ARCH_W, len - 1.5),
      height: ARCH_H,
      x: best.vertical ? best.at : mid,
      y: best.vertical ? mid : best.at,
      angle: best.vertical ? Math.PI / 2 : 0,
    });
    union(best.a, best.b);
  }

  return extra.length ? { ...g, openings: [...g.openings, ...extra] } : g;
}
