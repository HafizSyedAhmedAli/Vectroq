// apps/web/src/lib/import-csr.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tmcc/db", () => ({
  prisma: {
    $transaction: vi.fn().mockResolvedValue([]),
    rateSet: { updateMany: vi.fn(), createMany: vi.fn() },
  },
}));

import { prisma } from "@tmcc/db";
import { importCsr } from "./import-csr";

const HEADER = "city,itemType,unit,unitRate";
const CORE = [
  "brick,1000nos,20000",
  "cement,bag,1400",
  "sand,cft,60",
  "steelMaterial,ton,260000",
];
const rows = (city: string, skip?: string) =>
  CORE.filter((r) => !skip || !r.startsWith(skip)).map((r) => `${city},${r}`);
const csvOf = (...lines: string[]) => [HEADER, ...lines].join("\n");

const base = {
  document: "Sindh CSR",
  year: 2026,
  categories: ["A", "B", "C"] as ("A" | "B" | "C")[],
  approvedBy: "Office",
};

describe("importCsr", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates one APPROVED csr set per city per category and records the source", async () => {
    const r = await importCsr({ ...base, csv: csvOf(...rows("Karachi")) });

    expect(r).toEqual({ ok: true, imported: 3, cities: ["Karachi"] });
    const { data } = (prisma.rateSet.createMany as any).mock.calls[0][0];
    expect(data).toHaveLength(3);
    expect(data[0]).toMatchObject({
      city: "Karachi",
      status: "APPROVED",
      origin: "csr",
      approvedBy: "Office",
      sources: { document: "Sindh CSR", year: 2026 },
    });
    expect(prisma.rateSet.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "SUPERSEDED" },
        where: expect.objectContaining({ origin: "csr", status: "APPROVED" }),
      }),
    );
  });

  it("accepts a CSV saved by Excel (UTF-8 BOM, CRLF)", async () => {
    const csv = "\uFEFF" + csvOf(...rows("Karachi")).replace(/\n/g, "\r\n");
    expect((await importCsr({ ...base, csv })).ok).toBe(true);
  });

  it("stores an alias under the canonical city name", async () => {
    const r = await importCsr({ ...base, csv: csvOf(...rows("Benazirabad")) });
    expect(r).toMatchObject({ ok: true, cities: ["Nawabshah"] });
  });

  it("rejects an unknown city and saves nothing", async () => {
    const r = await importCsr({ ...base, csv: csvOf(...rows("Karahci")) });
    expect(r).toMatchObject({ ok: false });
    expect((r as any).error).toMatch(/karahci/i);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects the same city under two names", async () => {
    const r = await importCsr({
      ...base,
      csv: csvOf(...rows("Nawabshah"), ...rows("Benazirabad")),
    });
    expect(r).toMatchObject({ ok: false });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a city that lacks a core material", async () => {
    const r = await importCsr({
      ...base,
      csv: csvOf(...rows("Karachi", "steelMaterial")),
    });
    expect((r as any).error).toMatch(/steelMaterial/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an empty file and an empty category list", async () => {
    expect((await importCsr({ ...base, csv: "  " })).ok).toBe(false);
    expect(
      (
        await importCsr({
          ...base,
          categories: [],
          csv: csvOf(...rows("Karachi")),
        })
      ).ok,
    ).toBe(false);
  });
});
