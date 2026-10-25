import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: string[] = [];
const op = (name: string) => vi.fn((a?: unknown) => { calls.push(name); return { name, a }; });
const db = vi.hoisted(() => ({}) as Record<string, any>);
const orgFind = vi.fn(), memFind = vi.fn(), tx = vi.fn();
Object.assign(db, {
  organization: { findMany: (a: unknown) => orgFind(a), deleteMany: op("org.delete") },
  membership: { findMany: (a: unknown) => memFind(a) },
  cadFile: { deleteMany: op("cad.delete") },
  render: { deleteMany: op("render.delete") },
  project: { deleteMany: op("project.delete") },
  lead: { deleteMany: op("lead.delete") },
  rateSet: { deleteMany: op("rateSet.delete") },
  user: { deleteMany: op("user.delete") },
  $transaction: (a: unknown) => tx(a),
});
vi.mock("@vectroq/db", () => ({ prisma: db }));

import { cleanupExpiredDemos, DEMO_HOURS, MAX_ACTIVE_DEMOS } from "./demo";

beforeEach(() => { orgFind.mockReset(); memFind.mockReset(); tx.mockReset(); calls.length = 0; });

describe("demo", () => {
  it("exports limits", () => {
    expect(DEMO_HOURS).toBe(24);
    expect(MAX_ACTIVE_DEMOS).toBe(200);
  });

  it("queries only expired demo orgs, max 20", async () => {
    orgFind.mockResolvedValue([]);
    await cleanupExpiredDemos();
    const arg = orgFind.mock.calls[0][0];
    expect(arg.where.isDemo).toBe(true);
    expect(arg.where.demoExpiresAt.lt).toBeInstanceOf(Date);
    expect(arg.take).toBe(20);
  });

  it("does nothing when no demos expired", async () => {
    orgFind.mockResolvedValue([]);
    await cleanupExpiredDemos();
    expect(memFind).not.toHaveBeenCalled();
    expect(tx).not.toHaveBeenCalled();
  });

  it("deletes everything in one transaction, children before the org", async () => {
    orgFind.mockResolvedValue([{ id: "o1" }, { id: "o2" }]);
    memFind.mockResolvedValue([{ userId: "u1" }, { userId: "u2" }]);
    tx.mockResolvedValue([]);
    await cleanupExpiredDemos();
    expect(memFind).toHaveBeenCalledWith({ where: { organizationId: { in: ["o1", "o2"] } }, select: { userId: true } });
    expect(tx).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(["cad.delete", "render.delete", "project.delete", "lead.delete", "rateSet.delete", "user.delete", "org.delete"]);
    const userArg = db.user.deleteMany.mock.calls[0][0];
    expect(userArg.where).toEqual({ id: { in: ["u1", "u2"] }, email: { endsWith: "@demo.invalid" } });
    expect(db.organization.deleteMany.mock.calls[0][0]).toEqual({ where: { id: { in: ["o1", "o2"] } } });
  });
});
