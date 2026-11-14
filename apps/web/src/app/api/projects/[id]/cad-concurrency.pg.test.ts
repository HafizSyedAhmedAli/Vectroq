// @vitest-environment node
//
// REAL PostgreSQL integration test for the CadFile revision protocol.
//
// Unlike cad-concurrency.test.ts (an in-memory model of the database), this file
// runs the real route handlers against a real PostgreSQL server through the real
// Prisma client, so it exercises row locks, READ COMMITTED re-evaluation of the
// conditional UPDATE, and real transaction rollback.
//
// It is SKIPPED unless TEST_DATABASE_URL is set, and refuses to run unless the
// database name ends in "_test" (it inserts and deletes its own rows only).
//
//   createdb vectroq_test
//   DATABASE_URL=postgresql://localhost/vectroq_test \
//     pnpm --filter @vectroq/db exec prisma migrate deploy
//   TEST_DATABASE_URL=postgresql://localhost/vectroq_test \
//     pnpm --filter web exec vitest run cad-concurrency.pg
//
// Only auth, audit, rate limiting, blob storage and the rate-card lookup are
// faked (none of them is PostgreSQL). The conditional writes, transactions and
// the CadFile/Project rows are real. See docs/dxf-units.md, "Concurrency".
import { createRequire } from "node:module";
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";

const URL_ = process.env.TEST_DATABASE_URL ?? "";
const enabled = URL_ !== "";
if (enabled && !/_test(\?|$)/.test(URL_)) {
  throw new Error("TEST_DATABASE_URL must point at a database whose name ends in _test");
}

const h = vi.hoisted(() => ({
  orgId: "",
  blobs: new Map<string, string>(),
  deleted: [] as string[],
  n: 0,
  // Hooks that sit exactly between a request's read and its conditional write.
  rates: null as null | (() => Promise<void>),
  readDxf: null as null | (() => Promise<void>),
  saveDxf: null as null | (() => Promise<void>),
}));

vi.mock("@vectroq/db", async () => {
  // Resolve the real client the same way @vectroq/db does, WITHOUT importing
  // @vectroq/db itself (which would construct a default client from DATABASE_URL).
  const req = createRequire(createRequire(import.meta.url).resolve("@vectroq/db/package.json"));
  const { Prisma, PrismaClient } = req("@prisma/client");
  let client: any = null;
  if (process.env.TEST_DATABASE_URL) {
    // TEST_PRISMA_ADAPTER_MODULE is only for environments that cannot download the
    // Prisma query engine (Rust-free client + pg driver adapter). Normal setups
    // leave it unset and use the default engine.
    const adapterPath = process.env.TEST_PRISMA_ADAPTER_MODULE;
    if (adapterPath) {
      const { PrismaPg } = createRequire(import.meta.url)(adapterPath);
      client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL }) });
    } else {
      client = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
    }
  }
  return { Prisma, prisma: client };
});

vi.mock("@/lib/auth/guard", () => ({
  guard: vi.fn(async () => ({
    ok: true,
    auth: { org: { id: h.orgId, slug: "t", rules: null, isDemo: false }, role: "OWNER", user: { id: "u1", email: "t@t.co", name: "T" } },
  })),
}));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn().mockResolvedValue({ ok: true }), tooMany: vi.fn() }));
vi.mock("@/lib/cad-dxf-store", () => ({
  saveCadDxf: vi.fn(async (_p: string, text: string) => {
    await h.saveDxf?.();
    const k = `cad-dxf/new-${++h.n}.dxf`;
    h.blobs.set(k, text);
    return k;
  }),
  readCadDxf: vi.fn(async (k: string) => {
    const text = h.blobs.get(k) ?? null;
    await h.readDxf?.();
    return text;
  }),
  deleteCadDxf: vi.fn(async (k: string | null) => { if (k) { h.blobs.delete(k); h.deleted.push(k); } }),
}));
vi.mock("@/lib/rate-sets", async (orig) => ({
  ...(await orig<typeof import("@/lib/rate-sets")>()),
  getRateCardWithBasis: vi.fn(async () => {
    await h.rates?.();
    return {
      card: { city: "Karachi", category: "B", taxPercent: 17, items: [] },
      basis: { place: "Karachi", isFallback: false, origin: "csr", sources: { document: "Sindh CSR", year: 2026 } },
    };
  }),
}));
vi.mock("@vectroq/rate-cards", async (orig) => ({
  ...(await orig<typeof import("@vectroq/rate-cards")>()),
  estimateFromGeometry: vi.fn(() => ({ total: 123, lineItems: [] })),
}));

import { prisma } from "@vectroq/db";
import { PATCH } from "./geometry/route";
import { POST as CONFIRM } from "./cad-unit/route";
import { POST as FINALIZE } from "./finalize/route";
import { POST as UPLOAD } from "./cad-upload/route";

const db = prisma as any;
const DXF = ["0","SECTION","2","ENTITIES","0","LWPOLYLINE","8","WALLS","90","4","70","1","10","0","20","0","10","40","20","0","10","40","20","30","10","0","20","30","0","ENDSEC","0","EOF",""].join("\n");
const DXF2 = DXF.replace(/\n40\n/g, "\n50\n");
const unconfirmed = { unit: { unit: "foot", feetPerUnit: 1, source: "plausibility", confidence: "low", confirmed: false, needsConfirmation: true }, warnings: [] };
const trusted = { unit: { unit: "foot", feetPerUnit: 1, source: "user", confidence: "high", confirmed: true, needsConfirmation: false }, warnings: [] };
const geo = (len: number) => ({ walls: [{ id: "w", startX: 0, startY: 0, endX: len, endY: 0, length: len, height: 10, thickness: 0.75 }], rooms: [{ id: "r", name: "Living", area: 100, type: "general" }], openings: [] });

let projectId = "";
let ctx: { params: Promise<{ id: string }> };
const call = <T extends (...a: any[]) => any>(fn: T, init: RequestInit) => fn(new Request("http://x", init) as any, ctx);
const patch = (len: number, rev: number) => call(PATCH, { method: "PATCH", body: JSON.stringify({ ...geo(len), expectedRevision: rev }) });
const confirm = (unit: string, rev: number) => call(CONFIRM, { method: "POST", body: JSON.stringify({ unit, expectedRevision: rev }) });
const finalize = () => call(FINALIZE, { method: "POST" });
const upload = (text: string) => { const f = new FormData(); f.append("file", new File([text], "plan.dxf")); return call(UPLOAD, { method: "POST", body: f }); };
const codeOf = async (r: Response) => (await r.json()).code as string | undefined;
const cad = () => db.cadFile.findUnique({ where: { projectId } });
const status = async () => (await db.project.findUnique({ where: { id: projectId } })).status as string;

/** Resolves once `n` callers have arrived, so they all proceed at the same instant. */
function barrier(n: number) {
  let arrived = 0;
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  return () => { if (++arrived >= n) release(); return gate; };
}

async function seed(unit: object, over: { boq?: object; status?: string } = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const org = await db.organization.create({ data: { slug: `pgt-${suffix}`, name: "PG test" } });
  const lead = await db.lead.create({ data: { name: "L", contact: "c", city: "Karachi", model: 2, category: "B", organizationId: org.id } });
  const project = await db.project.create({ data: { leadId: lead.id, organizationId: org.id, model: 2, category: "B", city: "Karachi", status: over.status ?? "CAD_UPLOADED" } });
  h.orgId = org.id;
  projectId = project.id;
  ctx = { params: Promise.resolve({ id: projectId }) };
  h.blobs.set("cad-dxf/old.dxf", DXF);
  await db.cadFile.create({ data: { projectId, fileName: "plan.dxf", format: "dxf", geometry: geo(40), unit, dxfBlobKey: "cad-dxf/old.dxf", ...(over.boq ? { boq: over.boq } : {}) } });
}

async function cleanup() {
  if (!projectId) return;
  const p = await db.project.findUnique({ where: { id: projectId } });
  await db.cadFile.deleteMany({ where: { projectId } });
  await db.project.deleteMany({ where: { id: projectId } });
  if (p) {
    await db.lead.deleteMany({ where: { id: p.leadId } });
    await db.organization.deleteMany({ where: { id: p.organizationId } });
  }
  projectId = "";
}

describe.skipIf(!enabled)("CadFile revision protocol on a real PostgreSQL database", () => {
  beforeAll(async () => { await db.$queryRaw`select 1`; });
  afterAll(async () => { await db.$disconnect(); });
  beforeEach(() => { h.blobs.clear(); h.deleted.length = 0; h.n = 0; h.rates = h.readDxf = h.saveDxf = null; });
  afterEach(async () => {
    h.rates = h.readDxf = h.saveDxf = null;
    await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS pgt_fail_finalize ON "Project"');
    await cleanup();
  });

  it("the migrated schema has the revision column (integer, not null, default 0)", async () => {
    const rows = await db.$queryRaw`select data_type, is_nullable, column_default from information_schema.columns where table_name = 'CadFile' and column_name = 'revision'`;
    expect(rows).toEqual([{ data_type: "integer", is_nullable: "NO", column_default: "0" }]);
  });

  it("READ COMMITTED: an UPDATE blocked on a row lock re-checks its WHERE after the other transaction commits and matches nothing", async () => {
    await seed(unconfirmed);
    let loserCount = -1;
    let loserWaitedMs = 0;
    let loser!: Promise<void>;
    await db.$transaction(async (tx1: any) => {
      const w = await tx1.cadFile.updateMany({ where: { projectId, revision: 0 }, data: { revision: { increment: 1 } } });
      expect(w.count).toBe(1); // tx1 now holds the row lock, uncommitted
      loser = db.$transaction(async (tx2: any) => {
        const t0 = Date.now();
        const r = await tx2.cadFile.updateMany({ where: { projectId, revision: 0 }, data: { revision: { increment: 1 } } });
        loserWaitedMs = Date.now() - t0;
        loserCount = r.count;
      });
      await new Promise((r) => setTimeout(r, 400)); // tx2 is blocked on tx1's lock meanwhile
    });
    await loser; // tx1 committed; tx2 unblocks
    expect(loserWaitedMs).toBeGreaterThan(250); // it really did wait for the lock
    expect(loserCount).toBe(0); // and re-evaluated revision = 0 against the committed row
    expect((await cad()).revision).toBe(1); // advanced exactly once
  });

  describe("two simultaneous unit confirmations", () => {
    it.each(Array.from({ length: 8 }, (_, i) => i))("exactly one wins (run %i)", async () => {
      await seed(unconfirmed);
      const at = barrier(2);
      h.readDxf = at; // both have read revision 0 and checked it; both now race to write
      const [a, b] = await Promise.all([confirm("metre", 0), confirm("inch", 0)]);
      const statuses = [a.status, b.status].sort();
      expect(statuses).toEqual([200, 409]);
      const loser = a.status === 409 ? a : b;
      expect(await codeOf(loser)).toBe("CAD_FILE_REVISION_CONFLICT");
      const row = await cad();
      expect(row.revision).toBe(1);
      const winnerUnit = a.status === 200 ? "metre" : "inch";
      expect(row.unit.unit.unit).toBe(winnerUnit); // the stored unit is the winner's, not a mix
      expect(row.unit.unit.confirmed).toBe(true);
      expect(await status()).toBe("CAD_UPLOADED");
    });
  });

  describe("upload racing a unit confirmation", () => {
    it("deterministic: the confirmation read first, the upload commits, the confirmation is refused and cannot mix files", async () => {
      await seed(unconfirmed);
      const confirmReadDone = barrier(1);
      let letConfirmContinue!: () => void;
      const hold = new Promise<void>((r) => (letConfirmContinue = r));
      h.readDxf = async () => { await confirmReadDone(); await hold; };
      const confirming = confirm("metre", 0); // has read revision 0 + the old DXF, parked
      await new Promise((r) => setTimeout(r, 200));
      h.readDxf = null;
      expect((await upload(DXF2)).status).toBe(200); // commits revision 1 with the new DXF
      letConfirmContinue();
      const res = await confirming;
      expect(res.status).toBe(409);
      const row = await cad();
      expect(row.revision).toBe(1);
      expect(h.blobs.get(row.dxfBlobKey)).toBe(DXF2);
      expect(row.unit.unit.confirmed).toBe(false); // the upload's state, not the metre confirmation
      expect([...h.blobs.keys()]).toEqual([row.dxfBlobKey]); // old blob deleted, no orphan
    });

    it.each(Array.from({ length: 10 }, (_, i) => i))("simultaneous (run %i): either order leaves one consistent revision", async () => {
      await seed(unconfirmed);
      const at = barrier(2);
      h.readDxf = at; // confirm: after its read
      h.saveDxf = at; // upload: before its transaction
      const [c, u] = await Promise.all([confirm("metre", 0), upload(DXF2)]);
      const row = await cad();
      const key = row.dxfBlobKey as string;
      // Invariant: the stored DXF, geometry source and unit state belong together.
      if (key === "cad-dxf/old.dxf") {
        expect(c.status).toBe(200); // confirmation won, upload lost
        expect(u.status).toBe(409);
        expect(row.unit.unit.confirmed).toBe(true);
        expect(h.blobs.get(key)).toBe(DXF);
      } else {
        expect(u.status).toBe(200); // upload committed last (it may have followed the confirmation)
        expect(row.unit.unit.confirmed).toBe(false);
        expect(h.blobs.get(key)).toBe(DXF2);
        if (c.status === 200) expect(row.revision).toBe(2); // confirm, then a later re-upload
        else expect(c.status).toBe(409);
      }
      expect([...h.blobs.keys()]).toEqual([key]); // never an orphan or a dangling key
      expect(await status()).toBe("CAD_UPLOADED");
      expect(row.boq).toBeNull();
    });
  });

  describe("finalize racing a geometry PATCH", () => {
    it("deterministic: the PATCH commits while finalize is pricing; the stale BOQ is not saved", async () => {
      await seed(trusted, { status: "CAD_UPLOADED" });
      h.rates = async () => { h.rates = null; expect((await patch(99, 0)).status).toBe(200); };
      const res = await finalize();
      expect(res.status).toBe(409);
      expect(await codeOf(res)).toBe("CAD_FILE_REVISION_CONFLICT");
      const row = await cad();
      expect(row.boq).toBeNull();
      expect(row.geometry.walls[0].length).toBe(99);
      expect(row.revision).toBe(1);
      expect(await status()).toBe("CAD_UPLOADED");
    });

    it.each(Array.from({ length: 10 }, (_, i) => i))("simultaneous (run %i): exactly one wins and BOQ, geometry and status agree", async () => {
      await seed(trusted);
      const at = barrier(2);
      h.rates = at; // finalize is priced and ready to write...
      const patching = (async () => { await at(); return patch(99, 0); })(); // ...as the PATCH fires
      const [f, p] = await Promise.all([finalize(), patching]);
      expect([f.status, p.status].sort()).toEqual([200, 409]);
      const row = await cad();
      expect(row.revision).toBe(1);
      if (f.status === 200) {
        expect(row.boq?.total).toBe(123);
        expect(row.geometry.walls[0].length).toBe(40); // BOQ belongs to the geometry it priced
        expect(await status()).toBe("FINALIZED");
      } else {
        expect(row.boq).toBeNull();
        expect(row.geometry.walls[0].length).toBe(99);
        expect(await status()).toBe("CAD_UPLOADED");
      }
    });
  });

  describe("atomicity (real transaction rollback)", () => {
    const failFinalizeTrigger = async () => {
      await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION pgt_fail_finalize_fn() RETURNS trigger AS $$ BEGIN IF NEW.status = 'FINALIZED' THEN RAISE EXCEPTION 'pgt: simulated status write failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
      await db.$executeRawUnsafe('CREATE TRIGGER pgt_fail_finalize BEFORE UPDATE ON "Project" FOR EACH ROW EXECUTE FUNCTION pgt_fail_finalize_fn()');
    };

    it("finalize: if the project status write fails inside the database, the BOQ write is rolled back", async () => {
      await seed(trusted);
      await failFinalizeTrigger();
      await expect(finalize()).rejects.toThrow();
      const row = await cad();
      expect(row.boq).toBeNull();
      expect(row.revision).toBe(0);
      expect(await status()).toBe("CAD_UPLOADED");
    });

    it("geometry PATCH on a FINALIZED project clears the BOQ and demotes the status together", async () => {
      await seed(trusted, { boq: { total: 5 }, status: "FINALIZED" });
      expect((await patch(41, 0)).status).toBe(200);
      const row = await cad();
      expect(row.boq).toBeNull();
      expect(row.revision).toBe(1);
      expect(await status()).toBe("CAD_UPLOADED");
    });

    it("geometry PATCH leaves a non-FINALIZED status alone", async () => {
      await seed(trusted, { status: "NEW" });
      expect((await patch(41, 0)).status).toBe(200);
      expect(await status()).toBe("NEW");
    });

    it("geometry PATCH: if the demotion fails inside the database, the BOQ is NOT cleared", async () => {
      await seed(trusted, { boq: { total: 5 }, status: "FINALIZED" });
      await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION pgt_fail_finalize_fn() RETURNS trigger AS $$ BEGIN IF NEW.status = 'CAD_UPLOADED' THEN RAISE EXCEPTION 'pgt: simulated demotion failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
      await db.$executeRawUnsafe('CREATE TRIGGER pgt_fail_finalize BEFORE UPDATE ON "Project" FOR EACH ROW EXECUTE FUNCTION pgt_fail_finalize_fn()');
      await expect(patch(41, 0)).rejects.toThrow();
      const row = await cad();
      expect(row.boq).toEqual({ total: 5 });
      expect(row.revision).toBe(0);
      expect(row.geometry.walls[0].length).toBe(40);
      expect(await status()).toBe("FINALIZED");
    });

    it("a unit change clears the BOQ, bumps the revision and un-finalizes the project in one transaction", async () => {
      await seed(trusted, { boq: { total: 5 }, status: "FINALIZED" });
      expect((await confirm("metre", 0)).status).toBe(200);
      const row = await cad();
      expect(row.boq).toBeNull();
      expect(row.revision).toBe(1);
      expect(await status()).toBe("CAD_UPLOADED");
    });

    it("two first uploads racing on a project with no CAD file: the unique projectId makes exactly one win, no orphan blob", async () => {
      await seed(trusted);
      await db.cadFile.deleteMany({ where: { projectId } });
      h.blobs.clear();
      const at = barrier(2);
      h.saveDxf = at;
      const [a, b] = await Promise.all([upload(DXF), upload(DXF2)]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);
      const row = await cad();
      expect([...h.blobs.keys()]).toEqual([row.dxfBlobKey]);
    });
  });

  it("revision semantics: finalize advances it, so a tab that loaded the drawing before the finalize must reload (conservative, nothing is lost)", async () => {
    await seed(trusted);
    expect((await finalize()).status).toBe(200); // revision 0 -> 1, BOQ saved
    const stale = await patch(41, 0); // a tab still holding revision 0
    expect(stale.status).toBe(409);
    expect(await codeOf(stale)).toBe("CAD_FILE_REVISION_CONFLICT");
    const row = await cad();
    expect(row.boq?.total).toBe(123); // the finalized BOQ is intact
    expect(row.geometry.walls[0].length).toBe(40);
    expect((await patch(41, 1)).status).toBe(200); // with the current revision the edit goes through
  });

  it("the browser's own flow: upload -> confirm -> save -> finalize, each step using ONLY the revision the previous response returned", async () => {
    await seed(trusted);
    await db.cadFile.deleteMany({ where: { projectId } }); // a project with no drawing yet
    h.blobs.clear();

    const up = await upload(DXF); // first upload
    expect(up.status).toBe(200);
    const upBody = await up.json();
    expect(typeof upBody.revision).toBe("number"); // the panel stores this
    expect(upBody.dxfBlobKey).toBeUndefined();
    expect(upBody.unitState.needsConfirmation).toBe(true);

    const conf = await confirm("foot", upBody.revision);
    expect(conf.status).toBe(200);
    const confBody = await conf.json();
    expect(confBody.revision).toBe(upBody.revision + 1);

    const saved = await patch(41, confBody.revision);
    expect(saved.status).toBe(200);
    const savedBody = await saved.json();
    expect(savedBody.revision).toBe(confBody.revision + 1);

    const fin = await finalize();
    expect(fin.status).toBe(200);
    const finBody = await fin.json();
    expect(finBody.revision).toBe(savedBody.revision + 1);

    const reup = await upload(DXF2); // re-upload returns the revision too
    expect(typeof (await reup.json()).revision).toBe("number");
  });

  it("finalize advances the revision by exactly one and returns it", async () => {
    await seed(trusted);
    const res = await finalize();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.revision).toBe(1);
    expect(body.dxfBlobKey).toBeUndefined();
    expect((await cad()).revision).toBe(1);
    expect(await status()).toBe("FINALIZED");
  });
});
