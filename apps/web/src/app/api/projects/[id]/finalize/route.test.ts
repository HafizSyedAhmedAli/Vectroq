// apps/web/src/app/api/projects/[id]/finalize/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RATE_ITEM_TYPES } from "@vectroq/shared-types";
import type { Category, Geometry, RateCard } from "@vectroq/shared-types";
import { POST } from "./route";

vi.mock("@vectroq/db", () => ({
  prisma: {
    project: { findFirst: vi.fn(), update: vi.fn() },
    cadFile: { findUnique: vi.fn(), update: vi.fn() },
    rateSet: { findFirst: vi.fn().mockResolvedValue(null) },
  },
}));

vi.mock("@/lib/auth/guard", () => ({
  guard: vi.fn().mockResolvedValue({
    ok: true,
    auth: {
      org: { id: "org_1", slug: "demo" },
      role: "OWNER",
      user: { id: "u1", email: "t@t.co", name: "Test" },
    },
  }),
}));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
import { guard } from "@/lib/auth/guard";

// Pass-through spy: real pricing, but lets tests prove it was (not) called.
vi.mock("@vectroq/rate-cards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@vectroq/rate-cards")>();
  return { ...actual, estimateFromGeometry: vi.fn(actual.estimateFromGeometry) };
});
import { estimateFromGeometry } from "@vectroq/rate-cards";

vi.mock("@/lib/rate-sets", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-sets")>();
  return { ...actual, getRateCardWithBasis: vi.fn() };
});

import { prisma } from "@vectroq/db";
import { getRateCardWithBasis, RateUnavailableError } from "@/lib/rate-sets";
import { audit } from "@/lib/audit";

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

// Persisted unit states (CadFile.unit) as the upload/confirm routes write them.
const CONFIRMED_UNIT = {
  unit: { feetPerUnit: 1, source: "header", confidence: "high", confirmed: false, needsConfirmation: false, unit: "foot" },
  warnings: [],
};
const UNCONFIRMED_UNIT = {
  unit: { feetPerUnit: 1, source: "plausibility", confidence: "low", confirmed: false, needsConfirmation: true, unit: "foot" },
  warnings: [{ code: "UNIT_AMBIGUOUS", severity: "warning", message: "m" }],
};

function arrange(city: string, unit: unknown = CONFIRMED_UNIT, boq: unknown = null) {
  (prisma.project.findFirst as any).mockResolvedValue({
    id: "p1",
    city,
    category: "B",
    model: 2,
  });
  (prisma.cadFile.findUnique as any).mockResolvedValue({
    id: "cad_1",
    projectId: "p1",
    geometry: GEOMETRY,
    unit,
    boq,
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
    (prisma.project.findFirst as any).mockResolvedValue(null);

    const res = await POST(req() as any, ctx("missing"));
    expect(res.status).toBe(404);
    expect(prisma.cadFile.findUnique).not.toHaveBeenCalled();
  });

  it("404s when no CAD file has been uploaded for the project yet", async () => {
    (prisma.project.findFirst as any).mockResolvedValue({
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
    expect(getRateCardWithBasis).toHaveBeenCalledWith(
      "org_1",
      "Karachi",
      "B",
      expect.anything(),
    );
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      "BOQ_CALCULATED",
      "Project",
      "p1",
      expect.objectContaining({ total: json.boq.total, previousTotal: null }),
    );
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

  describe("unit confirmation gate (server-side)", () => {
    const expectNothingPriced = () => {
      expect(estimateFromGeometry).not.toHaveBeenCalled();
      expect(getRateCardWithBasis).not.toHaveBeenCalled();
      expect(prisma.cadFile.update).not.toHaveBeenCalled();
      expect(prisma.project.update).not.toHaveBeenCalled();
      expect(audit).not.toHaveBeenCalled();
    };

    it("409s UNIT_CONFIRMATION_REQUIRED for an unconfirmed drawing and prices nothing", async () => {
      arrange("Karachi", UNCONFIRMED_UNIT);
      (getRateCardWithBasis as any).mockResolvedValue(resolved("Karachi"));
      const res = await POST(req() as any, ctx("p1"));
      const json = await res.json();
      expect(res.status).toBe(409);
      expect(json).toMatchObject({ code: "UNIT_CONFIRMATION_REQUIRED", reason: "needs-confirmation" });
      expect(json.unitState).toMatchObject({ needsConfirmation: true });
      expectNothingPriced();
    });

    it("409s for a legacy row with no unit state (units never verified), even if a BOQ already exists", async () => {
      arrange("Karachi", null, { total: 123 });
      const res = await POST(req() as any, ctx("p1"));
      const json = await res.json();
      expect(res.status).toBe(409);
      expect(json).toMatchObject({ code: "UNIT_CONFIRMATION_REQUIRED", reason: "legacy-unverified", unitState: null });
      expectNothingPriced(); // the saved BOQ is left exactly as it was
    });

    it("treats a damaged unit value as unverified", async () => {
      arrange("Karachi", { nonsense: true });
      expect((await POST(req() as any, ctx("p1"))).status).toBe(409);
      expectNothingPriced();
    });

    it("a manually edited but still unconfirmed drawing is still blocked (editing is not confirmation)", async () => {
      arrange("Karachi", { ...UNCONFIRMED_UNIT, geometryEditedAt: "2026-01-01T00:00:00.000Z" });
      expect((await POST(req() as any, ctx("p1"))).status).toBe(409);
      expectNothingPriced();
    });

    it("prices a user-confirmed drawing", async () => {
      arrange("Karachi", { unit: { ...UNCONFIRMED_UNIT.unit, source: "user", confirmed: true, needsConfirmation: false }, warnings: [] });
      (getRateCardWithBasis as any).mockResolvedValue(resolved("Karachi"));
      const res = await POST(req() as any, ctx("p1"));
      expect(res.status).toBe(200);
      expect(estimateFromGeometry).toHaveBeenCalledTimes(1);
      expect(prisma.project.update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { status: "FINALIZED" } });
    });
  });
});
