// Stage 3c-0 section E: provenance between raw / legacy / wall index spaces.
import { describe, expect, it } from "vitest";
import { dedupeSegments, dedupeWithAliases, type Seg } from "./line-plan";
import { normalizeModeBSegments } from "./mode-b-walls";

const S = (x1: number, y1: number, x2: number, y2: number): Seg => ({
  x1,
  y1,
  x2,
  y2,
});

describe("dedupeWithAliases", () => {
  it("exact duplicates map to their representative with offset 0", () => {
    const d = dedupeWithAliases([
      S(0, 0, 10, 0),
      S(0, 0, 10, 0),
      S(0, 5, 10, 5),
    ]);
    expect(d.segs).toHaveLength(2);
    expect(d.repRaw).toEqual([0, 2]);
    expect(d.rawToLegacy).toEqual([0, 0, 1]);
    expect(d.aliases[0]).toEqual([{ raw: 1, offsetFt: 0 }]);
    expect(d.aliases[1]).toEqual([]);
  });

  it("reversed duplicates map to their representative with offset 0", () => {
    const d = dedupeWithAliases([S(0, 0, 10, 0), S(10, 0, 0, 0)]);
    expect(d.rawToLegacy).toEqual([0, 0]);
    expect(d.aliases[0]).toEqual([{ raw: 1, offsetFt: 0 }]);
    expect(d.segs[0]).toBe(d.segs[0]);
  });

  it("a near-duplicate dropped by the existing rounding keeps its offset", () => {
    const d = dedupeWithAliases([S(0, 0, 10, 0), S(0.004, 0, 10, 0.003)]);
    expect(d.segs).toHaveLength(1);
    expect(d.rawToLegacy).toEqual([0, 0]);
    expect(d.aliases[0][0].raw).toBe(1);
    expect(d.aliases[0][0].offsetFt).toBeCloseTo(0.004, 12);
    // and reversed near duplicate: offset is measured in the better direction
    const r = dedupeWithAliases([S(0, 0, 10, 0), S(10, 0.003, 0.004, 0)]);
    expect(r.aliases[0][0].offsetFt).toBeCloseTo(0.004, 12);
  });

  it("a near-duplicate retained by the existing rounding stays a separate segment", () => {
    const d = dedupeWithAliases([S(0, 0, 10, 0), S(0.02, 0, 10, 0)]);
    expect(d.segs).toHaveLength(2);
    expect(d.rawToLegacy).toEqual([0, 1]);
    expect(d.aliases).toEqual([[], []]);
  });

  it("selects exactly what dedupeSegments selects (same objects, same order) and never maps to null", () => {
    let seed = 12345;
    const r = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let t = 0; t < 400; t++) {
      const raw: Seg[] = [];
      const n = 1 + Math.floor(r() * 12);
      for (let i = 0; i < n; i++) {
        const j = () => [0, 0.003, 0.004, 0.006, 0.02][Math.floor(r() * 5)];
        const a = Math.floor(r() * 4);
        const b = Math.floor(r() * 4);
        const s = S(a + j(), b + j(), a + 3 + j(), b + j());
        raw.push(r() < 0.3 ? S(s.x2, s.y2, s.x1, s.y1) : s);
      }
      const expected = dedupeSegments(raw);
      const d = dedupeWithAliases(raw);
      expect(d.segs.length).toBe(expected.length);
      d.segs.forEach((s, i) => expect(s).toBe(expected[i]));
      d.repRaw.forEach((rr, i) => expect(raw[rr]).toBe(d.segs[i]));
      d.rawToLegacy.forEach((l) => expect(l).toBeGreaterThanOrEqual(0));
      // every raw index is exactly one of: a representative, or exactly one alias
      const covered = new Set<number>();
      d.repRaw.forEach((x) => covered.add(x));
      d.aliases.flat().forEach((a) => {
        expect(covered.has(a.raw)).toBe(false);
        covered.add(a.raw);
      });
      expect(covered.size).toBe(raw.length);
    }
  });

  it("does not mutate the input or dedupeSegments' behaviour", () => {
    const raw = Object.freeze([
      Object.freeze(S(0, 0, 1, 0)),
      Object.freeze(S(1, 0, 0, 0)),
    ]);
    expect(() => dedupeWithAliases(raw)).not.toThrow();
    expect(dedupeSegments([...raw])).toHaveLength(1);
  });
});

describe("normalizeModeBSegments provenance", () => {
  it("merge off: wall i is legacy i, with representative and aliases as its raw lines", () => {
    const raw = [S(0, 0, 10, 0), S(10, 0, 0, 0), S(0, 5, 10, 5)];
    const {
      wallSegs,
      legacySegs,
      provenance: p,
    } = normalizeModeBSegments(raw, {
      merge: false,
      entityIndices: [4, 7, 9],
    });
    expect(wallSegs).toBe(legacySegs);
    expect(p.entityOfRaw).toEqual([4, 7, 9]);
    expect(p.rawToLegacy).toEqual([0, 0, 1]);
    expect(p.wallRaw).toEqual([[0, 1], [2]]);
    expect(p.wallLegacy).toEqual([[0], [1]]);
    expect(p.wallIds).toEqual(["wall-0", "wall-1"]);
    expect(p.legacy[0]).toMatchObject({
      id: 0,
      rawRep: 0,
      rawAliases: [1],
      walls: [0],
      primaryWall: 0,
    });
    expect(p.legacy[1]).toMatchObject({
      id: 1,
      rawRep: 2,
      rawAliases: [],
      walls: [1],
      primaryWall: 1,
    });
  });

  it("raw, legacy, wall and entity indices are genuinely different spaces", () => {
    // entity indices skip non-wall entities; legacy drops a duplicate; the merge joins two lines
    const raw = [S(0, 0, 10, 0), S(0, 0, 10, 0), S(6, 0, 16, 0), S(0, 9, 5, 9)];
    const {
      provenance: p,
      wallSegs,
      legacySegs,
    } = normalizeModeBSegments(raw, {
      merge: true,
      entityIndices: [2, 3, 8, 11],
    });
    expect(legacySegs).toHaveLength(3);
    expect(wallSegs).toHaveLength(2);
    expect(p.entityOfRaw).toEqual([2, 3, 8, 11]);
    expect(p.rawToLegacy).toEqual([0, 0, 1, 2]);
    expect(p.wallRaw).toEqual([[0, 1, 2], [3]]);
    expect(p.wallLegacy).toEqual([[0, 1], [2]]);
    expect(p.legacy.map((l) => l.walls)).toEqual([[0], [0], [1]]);
  });

  it("many legacy segments contribute to one physical wall", () => {
    const { provenance: p } = normalizeModeBSegments(
      [S(0, 0, 10, 0), S(6, 0, 16, 0), S(12, 0, 20, 0)],
      {
        merge: true,
      },
    );
    expect(p.wallRaw).toEqual([[0, 1, 2]]);
    expect(p.wallLegacy).toEqual([[0, 1, 2]]);
    p.legacy.forEach((l) => expect(l.walls).toEqual([0]));
  });

  it("one legacy segment can map to several physical walls (found by fuzzing)", () => {
    // raws 2 and 3 are near-duplicates (same 0.01 ft bucket) so legacy keeps one,
    // but the merge keeps both 0.06 ft lines separate (overlap too short to merge).
    const raw = [
      S(8.009, 0.049, 5.004, 0.004),
      S(5.04, 0.06, 8, 0.004),
      S(1, 0.06, 1, 0),
      S(1, 0.004, 1.004, 0.06),
    ];
    const { provenance: p, wallSegs } = normalizeModeBSegments(raw, {
      merge: true,
    });
    expect(wallSegs).toHaveLength(4);
    expect(p.rawToLegacy).toEqual([0, 1, 2, 2]);
    expect(p.legacy[2].rawRep).toBe(2);
    expect(p.legacy[2].rawAliases).toEqual([3]);
    expect(p.legacy[2].aliasOffsets[0].raw).toBe(3);
    expect(p.legacy[2].aliasOffsets[0].offsetFt).toBeCloseTo(0.004, 12);
    expect(p.legacy[2].walls).toEqual([2, 3]);
    expect(p.legacy[2].primaryWall).toBe(2);
    expect(p.wallLegacy[3]).toEqual([2]);
  });

  it("fuzz: every raw line lands in exactly one wall; relations are consistent", () => {
    let seed = 99;
    const r = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const jit = () =>
      [0, 0.004, 0.009, 0.02, 0.04, 0.049, 0.06][Math.floor(r() * 7)];
    for (let t = 0; t < 1500; t++) {
      const n = 1 + Math.floor(r() * 7);
      const raw: Seg[] = [];
      for (let i = 0; i < n; i++) {
        const a = Math.floor(r() * 12) + (r() < 0.5 ? 0 : jit());
        const b = Math.floor(r() * 12) + 1 + (r() < 0.5 ? 0 : jit());
        const d = jit();
        const e = jit();
        raw.push(r() < 0.5 ? S(a, d, b, e) : S(b, e, a, d));
      }
      for (const merge of [false, true]) {
        const {
          provenance: p,
          wallSegs,
          legacySegs,
        } = normalizeModeBSegments(raw, { merge });
        expect(p.wallRaw.length).toBe(wallSegs.length);
        expect(p.legacy.length).toBe(legacySegs.length);
        const owner = new Map<number, number>();
        p.wallRaw.forEach((srcs, w) =>
          srcs.forEach((x) => {
            expect(owner.has(x)).toBe(false);
            owner.set(x, w);
          }),
        );
        expect(owner.size).toBe(raw.length);
        p.legacy.forEach((l, i) => {
          expect(p.rawToLegacy[l.rawRep]).toBe(i);
          for (const a of l.rawAliases) expect(p.rawToLegacy[a]).toBe(i);
          const ws = new Set(
            [l.rawRep, ...l.rawAliases].map((x) => owner.get(x)!),
          );
          expect(l.walls).toEqual([...ws].sort((a, b) => a - b));
          expect(l.walls).toContain(l.primaryWall);
          expect(l.primaryWall).toBe(owner.get(l.rawRep));
        });
        p.wallLegacy.forEach((ls, w) => {
          for (const li of ls) expect(p.legacy[li].walls).toContain(w);
        });
      }
    }
  });

  it("unchanged outputs: wallSegs/legacySegs equal the pre-3c-0 values", () => {
    const raw = [
      S(0, 0, 10, 0),
      S(6, 0, 16, 0),
      S(16, 0, 16, 8),
      S(16, 8, 16, 8),
    ];
    const on = normalizeModeBSegments(raw, { merge: true });
    expect(on.legacySegs).toEqual(dedupeSegments(raw));
    const off = normalizeModeBSegments(raw, { merge: false });
    expect(off.wallSegs).toEqual(dedupeSegments(raw));
  });

  it("entity indices default to -1 when the caller does not supply them", () => {
    const { provenance: p } = normalizeModeBSegments([S(0, 0, 1, 0)], {
      merge: true,
    });
    expect(p.entityOfRaw).toEqual([-1]);
  });
});
