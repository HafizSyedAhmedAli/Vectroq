// @vitest-environment node
//
// Two-request interleavings against an in-memory database that implements the
// semantics the routes rely on: `updateMany WHERE projectId AND revision` matches
// nothing when the revision moved, and a failed transaction rolls back ITS OWN
// writes. A hook runs a second request at the exact point where a real second
// request could land: after the first request has read, before it writes.
import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, any>;
const h = vi.hoisted(() => {
  const state = { cad: null as null | Record<string, any>, project: { id: "p1", status: "CAD_UPLOADED", city: "Karachi", category: "B", model: 2 } as Record<string, any> };
  const ctl = {
    afterRead: null as null | (() => Promise<void>),
    failProjectUpdate: false,
    journal: null as null | Array<() => void>,
  };
  return { state, ctl };
});

vi.mock("@vectroq/db", () => {
  const { state, ctl } = h;
  const JsonNull = Symbol("Prisma.JsonNull");
  const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
  const readHook = async () => {
    const fn = ctl.afterRead;
    ctl.afterRead = null;
    if (fn) await fn();
  };
  const setCad = (next: Row | null) => {
    const prev = state.cad;
    ctl.journal?.push(() => { state.cad = prev; });
    state.cad = next;
  };
  const read = async () => {
    const copy = state.cad ? clone(state.cad) : null;
    await readHook();
    return copy;
  };
  const prisma: Record<string, any> = {
    project: {
      findFirst: async () => clone(state.project),
      update: async ({ data }: any) => {
        if (ctl.failProjectUpdate) throw new Error("project write failed");
        const prev = state.project;
        ctl.journal?.push(() => { state.project = prev; });
        state.project = { ...state.project, ...data };
        return clone(state.project);
      },
    },
    cadFile: {
      findFirst: read,
      findUnique: read,
      updateMany: async ({ where, data }: any) => {
        if (!state.cad || state.cad.projectId !== where.projectId || state.cad.revision !== where.revision)
          return { count: 0 };
        const next: Row = { ...state.cad };
        for (const [k, v] of Object.entries<any>(data)) {
          if (k === "revision") next.revision = state.cad.revision + v.increment;
          else next[k] = v === JsonNull ? null : clone(v);
        }
        setCad(next);
        return { count: 1 };
      },
      create: async ({ data }: any) => {
        if (state.cad) {
          const err: any = new (Prisma.PrismaClientKnownRequestError as any)("unique", { code: "P2002" });
          throw err;
        }
        setCad({ id: "cad_1", revision: 0, boq: null, ...clone(data) });
        return clone(state.cad);
      },
    },
    $transaction: async (fn: any) => {
      const mine: Array<() => void> = [];
      const outer = ctl.journal;
      ctl.journal = mine;
      try {
        return await fn(prisma);
      } catch (e) {
        mine.reverse().forEach((u) => u()); // roll back only this transaction's own writes
        throw e;
      } finally {
        ctl.journal = outer;
      }
    },
  };
  class PrismaClientKnownRequestError extends Error {
    code: string;
    constructor(m: string, o: { code: string }) { super(m); this.code = o.code; }
  }
  const Prisma = { JsonNull, PrismaClientKnownRequestError };
  return { prisma, Prisma };
});

vi.mock("@/lib/auth/guard", () => ({
  guard: vi.fn().mockResolvedValue({
    ok: true,
    auth: { org: { id: "org_1", slug: "demo", rules: null, isDemo: false }, role: "OWNER", user: { id: "u1", email: "t@t.co", name: "T" } },
  }),
}));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn().mockResolvedValue({ ok: true }), tooMany: vi.fn() }));
const blobs = vi.hoisted(() => ({ store: new Map<string, string>(), n: 0, deleted: [] as string[] }));
vi.mock("@/lib/cad-dxf-store", () => ({
  saveCadDxf: vi.fn(async (_p: string, text: string) => { const k = `cad-dxf/new-${++blobs.n}.dxf`; blobs.store.set(k, text); return k; }),
  readCadDxf: vi.fn(async (k: string) => blobs.store.get(k) ?? null),
  deleteCadDxf: vi.fn(async (k: string | null) => { if (k) { blobs.store.delete(k); blobs.deleted.push(k); } }),
}));
vi.mock("@/lib/rate-sets", async (orig) => ({
  ...(await orig<typeof import("@/lib/rate-sets")>()),
  getRateCardWithBasis: vi.fn(async () => ({
    card: { city: "Karachi", category: "B", taxPercent: 17, items: [] },
    basis: { place: "Karachi", isFallback: false, origin: "csr", sources: { document: "Sindh CSR", year: 2026 } },
  })),
}));
vi.mock("@vectroq/rate-cards", async (orig) => ({
  ...(await orig<typeof import("@vectroq/rate-cards")>()),
  estimateFromGeometry: vi.fn(() => ({ total: 123, lineItems: [] })),
}));

import { PATCH } from "./geometry/route";
import { POST as CONFIRM } from "./cad-unit/route";
import { POST as FINALIZE } from "./finalize/route";
import { POST as UPLOAD } from "./cad-upload/route";

const ctx = { params: Promise.resolve({ id: "p1" }) };
// Unitless 40 x 30 closed room: ambiguous feet/metres until a person confirms.
const DXF = ["0","SECTION","2","ENTITIES","0","LWPOLYLINE","8","WALLS","90","4","70","1","10","0","20","0","10","40","20","0","10","40","20","30","10","0","20","30","0","ENDSEC","0","EOF",""].join("\n");
const DXF2 = DXF.replace(/"40"/g, "50").replace("10\n40\n20\n0", "10\n50\n20\n0").replace("10\n40\n20\n30", "10\n50\n20\n30");
const unconfirmed = { unit: { unit: "foot", feetPerUnit: 1, source: "plausibility", confidence: "low", confirmed: false, needsConfirmation: true }, warnings: [] };
const trusted = { unit: { unit: "foot", feetPerUnit: 1, source: "user", confidence: "high", confirmed: true, needsConfirmation: false }, warnings: [] };
const geo = (len: number) => ({ walls: [{ id: "w", startX: 0, startY: 0, endX: len, endY: 0, length: len, height: 10, thickness: 0.75 }], rooms: [{ id: "r", name: "Living", area: 100, type: "general" }], openings: [] });

const patch = (g: object, rev: number) => PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify({ ...g, expectedRevision: rev }) }) as any, ctx);
const confirm = (unit: string, rev: number, extra: object = {}) => CONFIRM(new Request("http://x", { method: "POST", body: JSON.stringify({ unit, expectedRevision: rev, ...extra }) }) as any, ctx);
const finalize = () => FINALIZE(new Request("http://x", { method: "POST" }) as any, ctx);
const upload = (text: string) => { const f = new FormData(); f.append("file", new File([text], "plan.dxf")); return UPLOAD(new Request("http://x", { method: "POST", body: f }) as any, ctx); };
const code = async (r: Response) => (await r.json()).code;
const row = () => h.state.cad!;

function seed(unit: object = unconfirmed, over: Row = {}) {
  blobs.store.set("cad-dxf/old.dxf", DXF);
  h.state.cad = { id: "cad_1", projectId: "p1", fileName: "plan.dxf", format: "dxf", geometry: geo(40), unit, boq: null, dxfBlobKey: "cad-dxf/old.dxf", revision: 0, ...over };
  h.state.project = { id: "p1", status: "CAD_UPLOADED", city: "Karachi", category: "B", model: 2 };
}

beforeEach(() => {
  h.ctl.afterRead = null; h.ctl.failProjectUpdate = false; h.ctl.journal = null;
  blobs.store.clear(); blobs.deleted.length = 0; blobs.n = 0;
});

describe("stale geometry PATCH", () => {
  it("a tab holding revision 0 cannot attach old-scale geometry to a unit confirmed afterwards", async () => {
    seed();
    expect((await confirm("metre", 0)).status).toBe(200); // Tab B: metres, row is now revision 1
    const metreLen = Math.max(...row().geometry.walls.map((w: any) => w.length));
    expect(metreLen).toBeCloseTo(40 * 3.28084, 2);

    const res = await patch(geo(40), 0); // Tab A (stale): still feet-scale geometry
    expect(res.status).toBe(409);
    expect(await code(res)).toBe("CAD_FILE_REVISION_CONFLICT");
    expect(row().revision).toBe(1);
    expect(Math.max(...row().geometry.walls.map((w: any) => w.length))).toBeCloseTo(metreLen, 9); // untouched
    expect(row().unit.unit.confirmed).toBe(true);
  });

  it("a confirm landing between the PATCH's read and its write is caught by the conditional write", async () => {
    seed();
    h.ctl.afterRead = async () => { expect((await confirm("metre", 0)).status).toBe(200); };
    const res = await patch(geo(40), 0);
    expect(res.status).toBe(409);
    expect(row().revision).toBe(1);
    expect(row().unit.unit.unit).toBe("metre");
    expect(Math.max(...row().geometry.walls.map((w: any) => w.length))).toBeCloseTo(40 * 3.28084, 2);
  });

  it("a PATCH at the current revision succeeds and advances it", async () => {
    seed();
    const res = await patch(geo(41), 0);
    expect(res.status).toBe(200);
    expect(row().revision).toBe(1);
    expect((await res.json()).revision).toBe(1);
    expect(row().unit.geometryEditedAt).toBeDefined();
  });
});

describe("unit confirmation races", () => {
  it("two confirmations from the same revision: the second is refused, the first stays", async () => {
    seed();
    h.ctl.afterRead = async () => { expect((await confirm("metre", 0)).status).toBe(200); };
    const a = await confirm("inch", 0); // read at rev 0; "metre" commits before its write
    expect(a.status).toBe(409);
    expect(await code(a)).toBe("CAD_FILE_REVISION_CONFLICT");
    expect(row().unit.unit.unit).toBe("metre");
    expect(row().revision).toBe(1);
  });

  it("a confirmation cannot overwrite edits saved after its read", async () => {
    seed();
    h.ctl.afterRead = async () => { expect((await patch(geo(77), 0)).status).toBe(200); };
    const res = await confirm("metre", 0); // edit check passed on the unedited row
    expect(res.status).toBe(409);
    expect(row().geometry.walls[0].length).toBe(77); // the correction survived
    expect(row().unit.geometryEditedAt).toBeDefined();
  });

  it("an older confirmation cannot overwrite a newer upload, and the DXF/geometry/key stay one revision", async () => {
    seed();
    h.ctl.afterRead = async () => { expect((await upload(DXF2)).status).toBe(200); };
    const res = await confirm("metre", 0);
    expect(res.status).toBe(409);
    const key = row().dxfBlobKey as string;
    expect(key).toMatch(/new-1/);
    expect(blobs.store.get(key)).toBe(DXF2);
    expect(row().unit.unit.confirmed).toBe(false); // the upload's own unconfirmed state, not the metre confirmation
    expect(blobs.deleted).toEqual(["cad-dxf/old.dxf"]);
    expect(h.state.project.status).toBe("CAD_UPLOADED");
  });
});

describe("finalize races", () => {
  it("finalize racing a geometry PATCH: the stale BOQ is NOT saved and the project is not FINALIZED", async () => {
    seed(trusted);
    const { getRateCardWithBasis } = await import("@/lib/rate-sets");
    (getRateCardWithBasis as any).mockImplementationOnce(async () => {
      expect((await patch(geo(99), 0)).status).toBe(200); // lands while finalize is pricing
      return { card: { city: "Karachi", category: "B", taxPercent: 17, items: [] }, basis: { place: "Karachi", isFallback: false, origin: "csr", sources: { document: "Sindh CSR", year: 2026 } } };
    });
    const res = await finalize();
    expect(res.status).toBe(409);
    expect(await code(res)).toBe("CAD_FILE_REVISION_CONFLICT");
    expect(row().boq).toBeNull();
    expect(row().geometry.walls[0].length).toBe(99);
    expect(h.state.project.status).toBe("CAD_UPLOADED");
  });

  it("finalize racing a re-upload: the old BOQ cannot attach to the new drawing", async () => {
    seed(trusted);
    const { getRateCardWithBasis } = await import("@/lib/rate-sets");
    (getRateCardWithBasis as any).mockImplementationOnce(async () => {
      expect((await upload(DXF2)).status).toBe(200);
      return { card: { city: "Karachi", category: "B", taxPercent: 17, items: [] }, basis: { place: "Karachi", isFallback: false, origin: "csr", sources: { document: "Sindh CSR", year: 2026 } } };
    });
    const res = await finalize();
    expect(res.status).toBe(409);
    expect(row().boq).toBeNull();
    expect(h.state.project.status).toBe("CAD_UPLOADED");
  });

  it("finalize racing a unit confirmation: refused", async () => {
    seed(trusted);
    const { getRateCardWithBasis } = await import("@/lib/rate-sets");
    (getRateCardWithBasis as any).mockImplementationOnce(async () => {
      expect((await confirm("metre", 0)).status).toBe(200);
      return { card: { city: "Karachi", category: "B", taxPercent: 17, items: [] }, basis: { place: "Karachi", isFallback: false, origin: "csr", sources: { document: "Sindh CSR", year: 2026 } } };
    });
    expect((await finalize()).status).toBe(409);
    expect(row().boq).toBeNull();
    expect(row().unit.unit.unit).toBe("metre");
  });

  it("without interference finalize saves the BOQ, advances the revision and finalizes the project", async () => {
    seed(trusted);
    const res = await finalize();
    expect(res.status).toBe(200);
    expect(row().boq.total).toBe(123);
    expect(row().revision).toBe(1);
    expect(h.state.project.status).toBe("FINALIZED");
    expect((await res.json()).revision).toBe(1);
  });

  it("BOQ and status are atomic: if the status write fails, the BOQ is rolled back", async () => {
    seed(trusted);
    h.ctl.failProjectUpdate = true;
    await expect(finalize()).rejects.toThrow("project write failed");
    expect(row().boq).toBeNull();
    expect(row().revision).toBe(0);
    expect(h.state.project.status).toBe("CAD_UPLOADED");
  });
});

describe("upload races and atomicity", () => {
  it("two concurrent re-uploads: one wins, the loser's blob is removed, the old blob is deleted once, no dangling reference", async () => {
    seed();
    h.ctl.afterRead = async () => { expect((await upload(DXF2)).status).toBe(200); }; // B commits first
    const a = await upload(DXF); // A read revision 0
    expect(a.status).toBe(409);
    const key = row().dxfBlobKey as string;
    expect(blobs.store.has(key)).toBe(true); // the surviving reference exists
    expect(blobs.store.get(key)).toBe(DXF2);
    expect([...blobs.store.keys()]).toEqual([key]); // no orphan left behind
    expect(blobs.deleted.filter((k) => k === "cad-dxf/old.dxf")).toHaveLength(1);
  });

  it("two first uploads racing: the loser gets 409 and its blob is removed", async () => {
    h.state.cad = null;
    h.state.project = { id: "p1", status: "DRAFT", city: "Karachi", category: "B", model: 2 };
    h.ctl.afterRead = async () => { expect((await upload(DXF2)).status).toBe(200); };
    const a = await upload(DXF);
    expect(a.status).toBe(409);
    expect([...blobs.store.keys()]).toEqual([row().dxfBlobKey]);
  });

  it("a failing status write rolls the whole upload back: old row, old blob and new-blob cleanup", async () => {
    seed(trusted, { boq: { total: 5 } });
    h.state.project.status = "FINALIZED";
    h.ctl.failProjectUpdate = true;
    await expect(upload(DXF2)).rejects.toThrow("project write failed");
    expect(row().dxfBlobKey).toBe("cad-dxf/old.dxf");
    expect(row().boq).toEqual({ total: 5 });
    expect(row().revision).toBe(0);
    expect(h.state.project.status).toBe("FINALIZED");
    expect(blobs.store.has("cad-dxf/old.dxf")).toBe(true);
    expect([...blobs.store.keys()]).toEqual(["cad-dxf/old.dxf"]);
  });

  it("a unit change clears the BOQ and un-finalizes the project in the same transaction; a failing status write rolls both back", async () => {
    seed(trusted, { boq: { total: 5 } });
    h.state.project.status = "FINALIZED";
    h.ctl.failProjectUpdate = true;
    await expect(confirm("metre", 0)).rejects.toThrow("project write failed");
    expect(row().boq).toEqual({ total: 5 }); // not cleared without the status change
    expect(row().revision).toBe(0);
    h.ctl.failProjectUpdate = false;
    expect((await confirm("metre", 0)).status).toBe(200);
    expect(row().boq).toBeNull();
    expect(h.state.project.status).toBe("CAD_UPLOADED");
  });
});
