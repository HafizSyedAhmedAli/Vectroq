// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/import-csr", () => ({ importCsr: vi.fn() }));
vi.mock("@/lib/org", () => ({ getCurrentOrg: vi.fn() }));
vi.mock("@/lib/auth/guard", () => ({ guard: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
import { importCsr } from "@/lib/import-csr";
import { guard } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";

const asRole = (role: string) =>
  (guard as any).mockImplementation(async (min: string) => {
    const rank: any = { VIEWER: 0, ESTIMATOR: 1, OWNER: 2 };
    return rank[role] >= rank[min]
      ? { ok: true, auth: { org: { id: "org_1" }, role, user: { id: "u1" } } }
      : { ok: false, res: Response.json({ error: "no" }, { status: 403 }) };
  });
const call = (body: unknown) =>
  POST(
    new Request("http://localhost/x", {
      method: "POST",
      body: JSON.stringify(body),
    }) as any,
  );
const valid = {
  csv: "a,b",
  document: "CSR 2026",
  year: 2026,
  categories: ["A", "B"],
  approvedBy: "Ali",
};

describe("POST /api/rate-sets/import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asRole("ESTIMATOR");
    (importCsr as any).mockResolvedValue({ ok: true, imported: 4, cities: ["Karachi"] });
  });

  it("imports for the caller's org and audits", async () => {
    const res = await call(valid);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ imported: 4, cities: ["Karachi"] });
    expect(importCsr).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org_1", categories: ["A", "B"], year: 2026 }),
    );
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      "RATES_IMPORTED",
      "RateSet",
      null,
      expect.objectContaining({ document: "CSR 2026", cities: ["Karachi"] }),
    );
  });

  it("filters out invalid categories", async () => {
    await call({ ...valid, categories: ["A", "Z", 5] });
    expect((importCsr as any).mock.calls[0][0].categories).toEqual(["A"]);
  });

  it.each([
    ["missing approvedBy", { ...valid, approvedBy: "" }],
    ["missing document", { ...valid, document: " " }],
    ["no valid categories", { ...valid, categories: ["Z"] }],
    ["approvedBy too long", { ...valid, approvedBy: "x".repeat(101) }],
    ["year out of range", { ...valid, year: 1999 }],
    ["year not an integer", { ...valid, year: 2026.5 }],
    ["csv not a string", { ...valid, csv: 5 }],
  ])("400s on %s", async (_n, body) => {
    expect((await call(body)).status).toBe(400);
    expect(importCsr).not.toHaveBeenCalled();
  });

  it("400s with the importer's error", async () => {
    (importCsr as any).mockResolvedValue({ ok: false, error: "Bad CSV" });
    const res = await call(valid);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Bad CSV");
    expect(audit).not.toHaveBeenCalled();
  });

  it("forbids VIEWER", async () => {
    asRole("VIEWER");
    expect((await call(valid)).status).toBe(403);
    expect(importCsr).not.toHaveBeenCalled();
  });
});
