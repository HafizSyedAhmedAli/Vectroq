import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const db = vi.hoisted(() => ({
  lead: { create: vi.fn() },
  project: { create: vi.fn(), update: vi.fn() },
  cadFile: { create: vi.fn(), update: vi.fn() },
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
const parsed = (unit: object = confirmedUnit) => ({ geometry, meta: { parserVersion: "t", unit, warnings: [{ code: "UNIT_USER_CONFIRMED", severity: "info", message: "m" }], stats: {} } });

beforeEach(() => {
  Object.values(db).forEach((t) => Object.values(t).forEach((f) => f.mockReset()));
  parse.mockReset().mockReturnValue(parsed());
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
    expect(db.cadFile.update.mock.calls[0][0]).toEqual({
      where: { projectId: "P1" },
      data: { boq: { total: 99, rateBasis: { basis: "DEFAULT", city: "Karachi" } } },
    });
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
    expect(parse.mock.calls[0][1]).toMatchObject({ confirmedUnit: "millimetre" });
    const data = db.cadFile.create.mock.calls[0][0].data;
    expect(data.unit.unit).toMatchObject({ unit: "millimetre", source: "user", confirmed: true });
    expect(data.unit.warnings[0].code).toBe("UNIT_USER_CONFIRMED");
    expect(data.dxfBlobKey).toBeUndefined();
  });

  it("does NOT price when the parser reports an unconfirmed unit (same rule as finalize)", async () => {
    parse.mockReturnValue(parsed({ ...confirmedUnit, source: "plausibility", confirmed: false, needsConfirmation: true }));
    getRate.mockResolvedValue({ card: {}, basis: "X" });
    estimate.mockReturnValue({ total: 99 });
    await expect(createSampleProject(org, "http://h")).resolves.toEqual({ projectId: "P1", priced: false });
    expect(getRate).not.toHaveBeenCalled();
    expect(estimate).not.toHaveBeenCalled();
    expect(db.cadFile.update).not.toHaveBeenCalled();
    expect(db.project.update).not.toHaveBeenCalled();
  });
});
