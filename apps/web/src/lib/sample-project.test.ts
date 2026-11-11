import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const db = vi.hoisted(() => ({
  lead: { create: vi.fn() },
  project: { create: vi.fn(), update: vi.fn() },
  cadFile: { create: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() },
  $transaction: vi.fn(),
}));
const parse = vi.fn(), estimate = vi.fn(), getRate = vi.fn();
vi.mock("@vectroq/db", () => ({ prisma: db }));
vi.mock("@vectroq/cad-parser", () => ({ parseDxf: (...a: unknown[]) => parse(...a) }));
vi.mock("@vectroq/rate-cards", () => ({ estimateFromGeometry: (a: unknown) => estimate(a) }));
vi.mock("@/lib/rate-sets", async (orig) => ({
  ...(await orig<typeof import("@/lib/rate-sets")>()),
  getRateCardWithBasis: (...a: unknown[]) => getRate(...a),
}));
vi.mock("@/lib/rate-basis", () => ({ toRateBasisInfo: (b: unknown, c: string) => ({ basis: b, city: c }) }));

import { createSampleProject, SAMPLE_PLAN_PATH } from "./sample-project";
import { RateUnavailableError } from "@/lib/rate-sets";

const org = { id: "o1", rules: null } as never;
const geometry = { rooms: [] };
const confirmedUnit = { feetPerUnit: 1 / 304.8, source: "user", confidence: "high", confirmed: true, needsConfirmation: false, unit: "millimetre" };
// What the parser says about the sample when NOT told the unit: millimetres is the
// one plausible reading (the verification step checks exactly this).
const probeUnit = {
  feetPerUnit: 0.00328084, source: "plausibility", confidence: "medium", confirmed: false, needsConfirmation: true, unit: "millimetre",
  candidates: [
    { unit: "millimetre", plausible: true },
    { unit: "metre", plausible: false },
  ],
};
const parsed = (unit: object = confirmedUnit) => ({ geometry, meta: { parserVersion: "t", unit, warnings: [{ code: "UNIT_USER_CONFIRMED", severity: "info", message: "m" }], stats: {} } });

beforeEach(() => {
  Object.values(db).forEach((t) => (typeof t === "function" ? (t as ReturnType<typeof vi.fn>).mockReset() : Object.values(t).forEach((f) => f.mockReset())));
  db.$transaction.mockImplementation((fn: (c: typeof db) => unknown) => fn(db));
  db.cadFile.updateMany.mockResolvedValue({ count: 1 });
  db.cadFile.findUnique.mockResolvedValue({ id: "c1" });
  parse.mockReset().mockImplementation((_t: string, o?: { confirmedUnit?: string }) => (o?.confirmedUnit ? parsed() : parsed(probeUnit)));
  estimate.mockReset(); getRate.mockReset();
  db.lead.create.mockResolvedValue({ id: "L1" });
  db.project.create.mockResolvedValue({ id: "P1" });
  vi.stubGlobal("fetch", vi.fn(async () => new Response("DXF TEXT")));
});
afterEach(() => vi.unstubAllGlobals());

describe("createSampleProject", () => {
  it("fetches the bundled plan from the given origin", async () => {
    getRate.mockImplementation(() => { throw new RateUnavailableError("Karachi", "B", "none"); });
    await createSampleProject(org, "http://host");
    expect(fetch).toHaveBeenCalledWith(`http://host${SAMPLE_PLAN_PATH}`);
    expect(parse.mock.calls[0][0]).toBe("DXF TEXT");
  });

  it("throws when the sample plan is missing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    await expect(createSampleProject(org, "http://h")).rejects.toThrow("Sample plan is missing.");
    expect(db.lead.create).not.toHaveBeenCalled();
  });

  it("creates lead, project and cad file, then prices and finalizes", async () => {
    getRate.mockResolvedValue({ card: { c: 1 }, basis: "DEFAULT" });
    estimate.mockReturnValue({ total: 99 });
    await expect(createSampleProject(org, "http://h")).resolves.toEqual({ projectId: "P1", priced: true });
    expect(db.lead.create.mock.calls[0][0].data).toMatchObject({ organizationId: "o1", source: "SAMPLE", city: "Karachi", consent: true });
    expect(db.project.create.mock.calls[0][0].data).toMatchObject({ leadId: "L1", status: "CAD_UPLOADED", model: 2, category: "B" });
    expect(db.cadFile.create.mock.calls[0][0].data).toMatchObject({ projectId: "P1", format: "dxf", geometry });
    // Same atomic, revision-checked write as /finalize (a new row is revision 0).
    expect(db.cadFile.updateMany.mock.calls[0][0]).toEqual({
      where: { projectId: "P1", revision: 0 },
      data: { boq: { total: 99, rateBasis: { basis: "DEFAULT", city: "Karachi" } }, revision: { increment: 1 } },
    });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.project.update).toHaveBeenCalledWith({ where: { id: "P1" }, data: { status: "FINALIZED" } });
  });

  it("leaves the project at CAD_UPLOADED when the estimator returns nothing", async () => {
    getRate.mockResolvedValue({ card: {}, basis: "X" });
    estimate.mockReturnValue(null);
    await expect(createSampleProject(org, "http://h")).resolves.toEqual({ projectId: "P1", priced: false });
    expect(db.project.update).not.toHaveBeenCalled();
  });

  it("swallows RateUnavailableError and reports priced: false", async () => {
    getRate.mockImplementation(() => { throw new RateUnavailableError("Karachi", "B", "none"); });
    await expect(createSampleProject(org, "http://h")).resolves.toEqual({ projectId: "P1", priced: false });
  });

  it("rethrows unexpected errors", async () => {
    getRate.mockImplementation(() => { throw new Error("boom"); });
    await expect(createSampleProject(org, "http://h")).rejects.toThrow("boom");
  });

  it("parses with the unit confirmed as millimetres and persists that unit (the sample is genuinely mm)", async () => {
    getRate.mockImplementation(() => { throw new RateUnavailableError("Karachi", "B", "none"); });
    await createSampleProject(org, "http://h");
    // First parse is the unconfirmed probe; the second applies the verified unit.
    expect(parse.mock.calls[0][1].confirmedUnit).toBeUndefined();
    expect(parse.mock.calls[1][1]).toMatchObject({ confirmedUnit: "millimetre" });
    const data = db.cadFile.create.mock.calls[0][0].data;
    expect(data.unit.unit).toMatchObject({ unit: "millimetre", source: "user", confirmed: true });
    expect(data.unit.warnings[0].code).toBe("UNIT_USER_CONFIRMED");
    expect(data.dxfBlobKey).toBeUndefined();
  });

  it("does NOT confirm millimetres when the file no longer reads as millimetres (changed fixture)", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    // The "new" sample reads as metres: the hard-coded millimetre must not be applied.
    parse.mockImplementation((_t: string, o?: { confirmedUnit?: string }) =>
      o?.confirmedUnit
        ? parsed()
        : parsed({ ...probeUnit, unit: "metre", candidates: [{ unit: "metre", plausible: true }] }),
    );
    getRate.mockResolvedValue({ card: {}, basis: "X" });
    estimate.mockReturnValue({ total: 99 });
    await expect(createSampleProject(org, "http://h")).resolves.toEqual({ projectId: "P1", priced: false });
    expect(parse.mock.calls.every((c) => c[1].confirmedUnit === undefined)).toBe(true);
    expect(err).toHaveBeenCalled();
    expect(db.cadFile.updateMany).not.toHaveBeenCalled();
    expect(db.project.update).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it("does NOT price when the parser reports an unconfirmed unit (same rule as finalize)", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    parse.mockReturnValue(parsed({ ...confirmedUnit, source: "plausibility", confirmed: false, needsConfirmation: true }));
    getRate.mockResolvedValue({ card: {}, basis: "X" });
    estimate.mockReturnValue({ total: 99 });
    await expect(createSampleProject(org, "http://h")).resolves.toEqual({ projectId: "P1", priced: false });
    expect(getRate).not.toHaveBeenCalled();
    expect(estimate).not.toHaveBeenCalled();
    expect(db.cadFile.updateMany).not.toHaveBeenCalled();
    expect(db.project.update).not.toHaveBeenCalled();
    err.mockRestore();
  });
});
