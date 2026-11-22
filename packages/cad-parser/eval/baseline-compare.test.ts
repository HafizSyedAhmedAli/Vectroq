import { describe, expect, it } from "vitest";
import { BASELINE_TOLERANCE, firstMismatch } from "./baseline-compare";

const base = () => ({
  id: "window-0",
  x: 7.217848,
  ok: true,
  none: null,
  list: [1, 2, { y: 3 }],
});

describe("baseline comparator", () => {
  it("uses a 1e-9 tolerance", () => expect(BASELINE_TOLERANCE).toBe(1e-9));

  it("passes identical values", () =>
    expect(firstMismatch(base(), base())).toBeNull());

  it("passes a 1e-12 numeric difference", () => {
    const a = base();
    a.x += 1e-12;
    a.list[2] = { y: 3 + 1e-12 };
    expect(firstMismatch(a, base())).toBeNull();
  });

  it("passes the float-noise differences seen in Stage 3b-0 (1.6e-16, 8.9e-16)", () => {
    expect(firstMismatch({ x: 1.607148081805841e-16 }, { x: 0 })).toBeNull();
    expect(
      firstMismatch({ x: 7.217848000000002 }, { x: 7.217848000000001 }),
    ).toBeNull();
  });

  it("fails a 1e-6 numeric difference", () => {
    const a = base();
    a.x += 1e-6;
    expect(firstMismatch(a, base())).toMatch(/\$\.x/);
  });

  it("fails the size of an approved window correction", () =>
    expect(firstMismatch({ x: 25.42651 }, { x: 28.379266 })).not.toBeNull());

  it("fails NaN and Infinity", () => {
    expect(firstMismatch({ x: NaN }, { x: 1 })).not.toBeNull();
    expect(firstMismatch({ x: Infinity }, { x: 1 })).not.toBeNull();
  });

  it("fails a type change", () => {
    expect(firstMismatch({ x: "7" }, { x: 7 })).toMatch(/type/);
    expect(firstMismatch({ x: null }, { x: 0 })).toMatch(/type|null/);
    expect(firstMismatch({ x: [] }, { x: {} })).not.toBeNull();
  });

  it("fails key changes (added, removed, renamed)", () => {
    expect(firstMismatch({ ...base(), extra: 1 }, base())).toMatch(/keys/);
    const { ok: _ok, ...missing } = base();
    expect(firstMismatch(missing, base())).toMatch(/keys/);
    expect(firstMismatch({ xx: 1 }, { x: 1 })).toMatch(/keys/);
  });

  it("fails array length and order changes", () => {
    const a = base();
    a.list = [1, 2];
    expect(firstMismatch(a, base())).toMatch(/array length/);
    const b = base();
    b.list = [2, 1, { y: 3 }];
    expect(firstMismatch(b, base())).not.toBeNull();
  });

  it("requires strings, ids and booleans to match exactly", () => {
    expect(
      firstMismatch({ id: "window-1" }, { id: "window-0" }),
    ).not.toBeNull();
    expect(firstMismatch({ ok: false }, { ok: true })).not.toBeNull();
  });
});
