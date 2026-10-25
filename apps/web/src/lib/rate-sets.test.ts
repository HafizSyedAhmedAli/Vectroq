// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const tx = vi.hoisted(() => ({
  rateSet: { findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
}));
vi.mock("@vectroq/db", () => ({
  prisma: {
    rateSet: { findMany: vi.fn(), updateMany: vi.fn() },
    $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
  },
}));

import { prisma } from "@vectroq/db";
import {
  approveRateSet,
  getLiveRateCard,
  getRateCardWithBasis,
  RateSetError,
  RateUnavailableError,
  rejectRateSet,
} from "./rate-sets";

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

describe("getRateCardWithBasis: fallback ladder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks basis as fallback when a nearby city's rates are used", async () => {
    (prisma.rateSet.findMany as any)
      .mockResolvedValueOnce([]) // Nawabshah
      .mockResolvedValueOnce([row(1300, null)]); // Hyderabad
    const r = await getRateCardWithBasis("org_1", "Nawabshah", "B");
    expect(r.basis).toMatchObject({ place: "Hyderabad", isFallback: true, origin: "csr" });
    expect(cement(r)).toBe(1300);
    expect(r.card.city).toBe("Nawabshah");
  });

  it("basis is not a fallback for the city itself", async () => {
    (prisma.rateSet.findMany as any).mockResolvedValue([row(1, null)]);
    const r = await getRateCardWithBasis("org_1", "Karachi", "B");
    expect(r.basis).toMatchObject({ place: "Karachi", isFallback: false });
  });

  it("throws RateUnavailableError when nothing is found", async () => {
    (prisma.rateSet.findMany as any).mockResolvedValue([]);
    const err = await getRateCardWithBasis("org_1", "Karachi", "B").catch((e) => e);
    expect(err).toBeInstanceOf(RateUnavailableError);
    expect(err.message).toContain("No rates loaded for Karachi (Category B)");
    expect(err.city).toBe("Karachi");
  });

  it("getLiveRateCard returns only the card", async () => {
    (prisma.rateSet.findMany as any).mockResolvedValue([row(1400, null)]);
    const card = await getLiveRateCard("org_1", "Karachi", "B");
    expect(card.city).toBe("Karachi");
    expect(card.items.length).toBeGreaterThan(0);
  });
});

describe("approveRateSet / rejectRateSet", () => {
  beforeEach(() => vi.clearAllMocks());

  it("NOT_FOUND when the set is not in the org", async () => {
    tx.rateSet.findFirst.mockResolvedValue(null);
    const err = await approveRateSet("o", "r1", "u").catch((e) => e);
    expect(err).toBeInstanceOf(RateSetError);
    expect(err.code).toBe("NOT_FOUND");
  });

  it("NOT_DRAFT when already approved", async () => {
    tx.rateSet.findFirst.mockResolvedValue({ id: "r1", status: "APPROVED" });
    await expect(approveRateSet("o", "r1", "u")).rejects.toMatchObject({ code: "NOT_DRAFT" });
    expect(tx.rateSet.update).not.toHaveBeenCalled();
  });

  it("supersedes the previous approved set, then approves the draft", async () => {
    tx.rateSet.findFirst.mockResolvedValue({ id: "r1", status: "DRAFT", city: "Karachi", category: "B" });
    tx.rateSet.update.mockResolvedValue({ id: "r1", status: "APPROVED" });
    await approveRateSet("o", "r1", "user1");
    expect(tx.rateSet.updateMany).toHaveBeenCalledWith({
      where: { organizationId: "o", city: "Karachi", category: "B", status: "APPROVED" },
      data: { status: "SUPERSEDED" },
    });
    const arg = tx.rateSet.update.mock.calls[0][0];
    expect(arg.data).toMatchObject({ status: "APPROVED", approvedBy: "user1" });
    expect(arg.data).not.toHaveProperty("items");
  });

  it("overwrites items when edited items are passed", async () => {
    tx.rateSet.findFirst.mockResolvedValue({ id: "r1", status: "DRAFT", city: "K", category: "B" });
    const items = [{ itemType: "cement", unit: "bag", unitRate: 9 }] as any;
    await approveRateSet("o", "r1", "u", items);
    expect(tx.rateSet.update.mock.calls[0][0].data.items).toBe(items);
  });

  it("rejectRateSet only touches the org's DRAFT sets", async () => {
    await rejectRateSet("o", "r1");
    expect(prisma.rateSet.updateMany).toHaveBeenCalledWith({
      where: { id: "r1", organizationId: "o", status: "DRAFT" },
      data: { status: "REJECTED" },
    });
  });
});
