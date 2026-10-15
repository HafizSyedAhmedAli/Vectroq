// apps/web/src/app/api/projects/[id]/finalize/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RATE_ITEM_TYPES } from "@tmcc/shared-types";
import type { Category, Geometry, RateCard } from "@tmcc/shared-types";
import { POST } from "./route";

vi.mock("@tmcc/db", () => ({
  prisma: {
    project: { findUnique: vi.fn(), update: vi.fn() },
    cadFile: { findUnique: vi.fn(), update: vi.fn() },
    rateSet: { findFirst: vi.fn().mockResolvedValue(null) },
  },
}));

vi.mock("@/lib/rate-sets", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-sets")>();
  return { ...actual, getRateCardWithBasis: vi.fn() };
});

import { prisma } from "@tmcc/db";
import { getRateCardWithBasis, RateUnavailableError } from "@/lib/rate-sets";

const UNIT: Record<string, RateCard["items"][number]["unit"]> = {
  steelFixing: "ton",
  steelMaterial: "ton",
  sanitary: "bath",
  brick: "1000nos",
  cement: "bag",
  sand: "cft",
};

// Test-only fixture: the app has no built-in rates, so tests supply their own.
function liveCard(city: string, category: Category = "B"): RateCard {
  return {
    city,
    category,
    taxPercent: 17,
    items: RATE_ITEM_TYPES.map((itemType) => ({
      itemType,
      unit: UNIT[itemType] ?? "sqft",
      unitRate: 100,
    })),
  };
}

function resolved(city: string, place = city) {
  return {
    card: liveCard(city),
    basis: {
      place,
      isFallback: place !== city,
      origin: "csr",
      sources: { document: "Sindh CSR", year: 2026 },
    },
  };
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function req() {
  return new Request("http://localhost/api/projects/p1/finalize", {
    method: "POST",
  });
}

const GEOMETRY: Geometry = {
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
  rooms: [
    { id: "r1", name: "Living", area: 300, type: "general" },
    { id: "r2", name: "Bathroom 1", area: 40, type: "bathroom" },
  ],
  openings: [{ id: "o1", type: "door", width: 3, height: 7 }],
};

function arrange(city: string) {
  (prisma.project.findUnique as any).mockResolvedValue({
    id: "p1",
    city,
    category: "B",
    model: 2,
  });
  (prisma.cadFile.findUnique as any).mockResolvedValue({
    id: "cad_1",
    projectId: "p1",
    geometry: GEOMETRY,
  });
  (prisma.cadFile.update as any).mockImplementation(({ data }: any) =>
    Promise.resolve({
      id: "cad_1",
      projectId: "p1",
      geometry: GEOMETRY,
      ...data,
    }),
  );
}

describe("POST /api/projects/:id/finalize", () => {
  beforeEach(() => vi.clearAllMocks());

  it("404s when the project doesn't exist", async () => {
    (prisma.project.findUnique as any).mockResolvedValue(null);

    const res = await POST(req() as any, ctx("missing"));
    expect(res.status).toBe(404);
    expect(prisma.cadFile.findUnique).not.toHaveBeenCalled();
  });

  it("404s when no CAD file has been uploaded for the project yet", async () => {
    (prisma.project.findUnique as any).mockResolvedValue({
      id: "p1",
      city: "Karachi",
      category: "B",
    });
    (prisma.cadFile.findUnique as any).mockResolvedValue(null);

    const res = await POST(req() as any, ctx("p1"));
    expect(res.status).toBe(404);
    expect(prisma.cadFile.update).not.toHaveBeenCalled();
  });

  it("502s with a clear message and saves nothing when no rates exist (no placeholder fallback)", async () => {
    arrange("Multan");
    (getRateCardWithBasis as any).mockRejectedValue(
      new RateUnavailableError("Multan", "B", "no CSR data"),
    );

    const res = await POST(req() as any, ctx("p1"));
    const json = await res.json();

    expect(res.status).toBe(502);
    expect(json.error).toMatch(/multan/i);
    expect(prisma.cadFile.update).not.toHaveBeenCalled();
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it("prices the real geometry, records the rate basis, and marks the project FINALIZED", async () => {
    arrange("Karachi");
    (getRateCardWithBasis as any).mockResolvedValue(resolved("Karachi"));

    const res = await POST(req() as any, ctx("p1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.boq.total).toBeGreaterThan(0);
    for (const t of ["brick", "cement", "sand", "steelMaterial"]) {
      expect(json.boq.lineItems.some((l: any) => l.itemType === t)).toBe(true);
    }
    expect(
      json.boq.lineItems.find((l: any) => l.itemType === "sanitary")?.quantity,
    ).toBe(1);
    expect(json.boq.rateBasis).toEqual({
      label: "Sindh CSR 2026",
      place: "Karachi",
      requestedCity: "Karachi",
      isFallback: false,
      origin: "csr",
    });
    expect(prisma.cadFile.update).toHaveBeenCalledWith({
      where: { projectId: "p1" },
      data: { boq: json.boq },
    });
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { status: "FINALIZED" },
    });
  });

  it("flags the BOQ when another market's rates were used", async () => {
    arrange("Nawabshah");
    (getRateCardWithBasis as any).mockResolvedValue(
      resolved("Nawabshah", "Hyderabad"),
    );

    const json = await (await POST(req() as any, ctx("p1"))).json();

    expect(json.boq.rateBasis).toMatchObject({
      place: "Hyderabad",
      requestedCity: "Nawabshah",
      isFallback: true,
    });
  });
});
