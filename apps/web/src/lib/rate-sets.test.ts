// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@vectroq/db", () => ({
  prisma: { rateSet: { findMany: vi.fn() } },
}));

import { prisma } from "@vectroq/db";
import { getRateCardWithBasis } from "./rate-sets";

const items = (cement: number, skip?: string) =>
  [
    { itemType: "brick", unit: "1000nos", unitRate: 1 },
    { itemType: "cement", unit: "bag", unitRate: cement },
    { itemType: "sand", unit: "cft", unitRate: 1 },
    { itemType: "steelMaterial", unit: "ton", unitRate: 1 },
  ].filter((i) => i.itemType !== skip);

const row = (cement: number, organizationId: string | null, skip?: string) => ({
  organizationId,
  origin: "csr",
  sources: null,
  items: items(cement, skip),
});
const cement = (r: Awaited<ReturnType<typeof getRateCardWithBasis>>) =>
  r.card.items.find((i) => i.itemType === "cement")?.unitRate;

describe("getRateCardWithBasis: org rates override the shared library", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the org's own set when it has one", async () => {
    (prisma.rateSet.findMany as any).mockResolvedValue([
      row(1500, "org_1"),
      row(1400, null),
    ]);
    expect(cement(await getRateCardWithBasis("org_1", "Karachi", "B"))).toBe(
      1500,
    );
  });

  it("uses the shared set when the org has none", async () => {
    (prisma.rateSet.findMany as any).mockResolvedValue([row(1400, null)]);
    expect(cement(await getRateCardWithBasis("org_1", "Karachi", "B"))).toBe(
      1400,
    );
  });

  it("falls back to the shared set when the org's own set lacks a core material", async () => {
    (prisma.rateSet.findMany as any).mockResolvedValue([
      row(1500, "org_1", "sand"),
      row(1400, null),
    ]);
    expect(cement(await getRateCardWithBasis("org_1", "Karachi", "B"))).toBe(
      1400,
    );
  });
});
