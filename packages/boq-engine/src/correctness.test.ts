import { describe, it, expect } from "vitest";
import { calculateBoq } from "./calculate-boq";
import type { Geometry, RateCard } from "@tmcc/shared-types";

const g: Geometry = {
  walls: [
    {
      id: "w",
      startX: 0,
      startY: 0,
      endX: 100,
      endY: 0,
      length: 100,
      height: 10,
      thickness: 0.75,
    },
  ],
  rooms: [
    { id: "r1", name: "Lounge", area: 400, type: "general" },
    { id: "r2", name: "Bath", area: 100, type: "bathroom" },
  ],
  openings: [
    { id: "d", type: "door", width: 3, height: 7 },
    { id: "w1", type: "window", width: 4, height: 4 },
  ],
};
const card = (category: "A" | "B"): RateCard => ({
  city: "X",
  category,
  taxPercent: 0,
  items: [
    "masonry",
    "plaster",
    "tileFixing",
    "marbleFixing",
    "falseCeiling",
  ].map((t) => ({
    itemType: t as never,
    unit: "sqft" as const,
    unitRate: 1,
  })),
});
const q = (r: ReturnType<typeof calculateBoq>, t: string) =>
  r.lineItems.find((l) => l.itemType === t)?.quantity;

describe("BOQ correctness", () => {
  it("deducts door/window openings from masonry and plaster", () => {
    const r = calculateBoq(g, card("B"));
    expect(q(r, "masonry")).toBe(1000 - 37);
    expect(q(r, "plaster")).toBe((1000 - 37) * 2);
  });
  it("Category A: marble in dry rooms, tiles only in wet rooms (no double count)", () => {
    const r = calculateBoq(g, card("A"));
    expect(q(r, "marbleFixing")).toBe(400);
    expect(q(r, "tileFixing")).toBe(100);
  });
  it("Category B: tiles everywhere, no marble", () => {
    const r = calculateBoq(g, card("B"));
    expect(q(r, "tileFixing")).toBe(500);
    expect(q(r, "marbleFixing")).toBeUndefined();
  });
  it("false ceiling only in dry rooms", () => {
    expect(q(calculateBoq(g, card("B")), "falseCeiling")).toBe(400);
  });
});
