// packages/boq-engine/src/calculate-boq.test.ts
import { describe, it, expect } from "vitest";
import { calculateBoq } from "./calculate-boq";
import type { Geometry, RateCard } from "@tmcc/shared-types";

const oneWallOneRoom: Geometry = {
  walls: [
    {
      id: "w1",
      startX: 0,
      startY: 0,
      endX: 20,
      endY: 0,
      length: 20,
      height: 10,
      thickness: 0.75,
    },
  ],
  rooms: [{ id: "r1", name: "Kitchen", area: 47 }],
  openings: [],
};

const hyderabadCategoryB: RateCard = {
  city: "Hyderabad",
  category: "B",
  taxPercent: 5,
  items: [
    { itemType: "masonry", unitRate: 50, unit: "sqft" },
    { itemType: "tileFixing", unitRate: 50, unit: "sqft" },
  ],
};

describe("calculateBoq", () => {
  it("calculates masonry quantity and cost from wall face area", () => {
    const result = calculateBoq(oneWallOneRoom, hyderabadCategoryB);

    // wall face area = length (20ft) * height (10ft) = 200 sqft
    const masonryLine = result.lineItems.find((l) => l.itemType === "masonry");
    expect(masonryLine).toMatchObject({
      quantity: 200,
      unit: "sqft",
      unitRate: 50,
      subtotal: 10000,
    });
  });

  it("calculates tile quantity and cost from room floor area", () => {
    const result = calculateBoq(oneWallOneRoom, hyderabadCategoryB);

    const tileLine = result.lineItems.find((l) => l.itemType === "tileFixing");
    expect(tileLine).toMatchObject({
      quantity: 47,
      unit: "sqft",
      unitRate: 50,
      subtotal: 2350,
    });
  });

  it("sums line items, applies tax, and returns a total", () => {
    const result = calculateBoq(oneWallOneRoom, hyderabadCategoryB);

    // subtotal = 10000 (masonry) + 2350 (tile) = 12350
    expect(result.subtotal).toBe(12350);
    expect(result.tax).toBe(617.5); // 5% of 12350
    expect(result.total).toBe(12967.5);
  });

  it("skips any rate item type not present in the rate card", () => {
    const cardMissingTile: RateCard = {
      ...hyderabadCategoryB,
      items: [{ itemType: "masonry", unitRate: 50, unit: "sqft" }],
    };

    const result = calculateBoq(oneWallOneRoom, cardMissingTile);
    expect(
      result.lineItems.find((l) => l.itemType === "tileFixing"),
    ).toBeUndefined();
  });

  it("returns zero total for a project with no geometry", () => {
    const empty: Geometry = { walls: [], rooms: [], openings: [] };
    const result = calculateBoq(empty, hyderabadCategoryB);

    expect(result.lineItems).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

describe("calculateBoq — steelFixing", () => {
  it("calculates steel tonnage from total floor area using the configured kg-per-sqft rate", () => {
    const geometry: Geometry = {
      walls: [
        {
          id: "w1",
          startX: 0,
          startY: 0,
          endX: 20,
          endY: 0,
          length: 20,
          height: 10,
          thickness: 0.75,
        },
      ],
      rooms: [{ id: "r1", name: "Living Room", area: 250, type: "general" }],
      openings: [],
    };
    const rateCard: RateCard = {
      city: "Hyderabad",
      category: "B",
      taxPercent: 0,
      items: [{ itemType: "steelFixing", unitRate: 10000, unit: "ton" }],
    };
    const result = calculateBoq(geometry, rateCard);
    const steelLine = result.lineItems.find(
      (l) => l.itemType === "steelFixing",
    );
    expect(steelLine).toMatchObject({
      quantity: 1,
      unit: "ton",
      unitRate: 10000,
      subtotal: 10000,
    });
  });
});

describe("calculateBoq — sanitary", () => {
  it("prices sanitary per bathroom, counting only rooms typed as bathroom", () => {
    const geometry: Geometry = {
      walls: [],
      rooms: [
        { id: "r1", name: "Bath 1", area: 54, type: "bathroom" },
        { id: "r2", name: "Kitchen", area: 47, type: "kitchen" },
        { id: "r3", name: "Bath 2", area: 40, type: "bathroom" },
      ],
      openings: [],
    };
    const rateCard: RateCard = {
      city: "Hyderabad",
      category: "B",
      taxPercent: 0,
      items: [{ itemType: "sanitary", unitRate: 12000, unit: "bath" }],
    };
    const result = calculateBoq(geometry, rateCard);
    const sanitaryLine = result.lineItems.find(
      (l) => l.itemType === "sanitary",
    );
    expect(sanitaryLine).toMatchObject({
      quantity: 2,
      unit: "bath",
      unitRate: 12000,
      subtotal: 24000,
    });
  });

  it("produces no sanitary line when there are no bathrooms", () => {
    const geometry: Geometry = {
      walls: [],
      rooms: [{ id: "r1", name: "Living Room", area: 200, type: "general" }],
      openings: [],
    };
    const rateCard: RateCard = {
      city: "Hyderabad",
      category: "B",
      taxPercent: 0,
      items: [{ itemType: "sanitary", unitRate: 12000, unit: "bath" }],
    };
    const result = calculateBoq(geometry, rateCard);
    expect(
      result.lineItems.find((l) => l.itemType === "sanitary"),
    ).toBeUndefined();
  });
});

describe("calculateBoq — woodwork", () => {
  it("calculates woodwork area from door and window opening dimensions", () => {
    const geometry: Geometry = {
      walls: [],
      rooms: [],
      openings: [
        { id: "o1", type: "door", width: 3, height: 7 },
        { id: "o2", type: "window", width: 4, height: 3 },
      ],
    };
    const rateCard: RateCard = {
      city: "Hyderabad",
      category: "B",
      taxPercent: 0,
      items: [{ itemType: "woodwork", unitRate: 350, unit: "sqft" }],
    };
    const result = calculateBoq(geometry, rateCard);
    const woodLine = result.lineItems.find((l) => l.itemType === "woodwork");
    expect(woodLine).toMatchObject({
      quantity: 33,
      unit: "sqft",
      unitRate: 350,
      subtotal: 11550,
    });
  });
});

it("prices material lines only when the rate card includes them", () => {
  const withMaterials: RateCard = {
    ...hyderabadCategoryB,
    items: [
      { itemType: "brick", unitRate: 20000, unit: "1000nos" },
      { itemType: "cement", unitRate: 1400, unit: "bag" },
    ],
  };
  const result = calculateBoq(oneWallOneRoom, withMaterials);
  const brick = result.lineItems.find((l) => l.itemType === "brick");
  expect(brick).toMatchObject({ quantity: 2.7, subtotal: 54000 });
  expect(result.lineItems.find((l) => l.itemType === "cement")?.quantity).toBe(
    30,
  );
  // existing placeholder cards have no material items -> no material lines
  expect(
    calculateBoq(oneWallOneRoom, hyderabadCategoryB).lineItems.some(
      (l) => l.itemType === "brick",
    ),
  ).toBe(false);
});
