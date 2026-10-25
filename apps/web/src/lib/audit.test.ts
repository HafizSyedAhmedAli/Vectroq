import { describe, it, expect, vi, beforeEach } from "vitest";

let impl: (a: unknown) => unknown = () => ({});
const create = vi.fn((a: unknown) => impl(a));
vi.mock("@vectroq/db", () => ({ prisma: { auditLog: { create: (a: unknown) => create(a) } } }));

import { audit } from "./audit";

beforeEach(() => { create.mockClear(); impl = () => ({}); });

describe("audit", () => {
  it("writes org, user and entity data", async () => {
    
    await audit({ org: { id: "o1" }, user: { id: "u1", email: "a@b.c" } }, "LOGIN", "User", "u1", { a: 1 });
    expect(create).toHaveBeenCalledWith({
      data: {
        organizationId: "o1", userId: "u1", userEmail: "a@b.c",
        action: "LOGIN", entityType: "User", entityId: "u1", metadata: { a: 1 },
      },
    });
  });

  it("uses nulls/undefined when user and metadata are absent", async () => {
    
    await audit({ org: { id: "o1" } }, "LEAD_CREATED", "Lead", null);
    const { data } = create.mock.calls[0][0];
    expect(data.userId).toBeNull();
    expect(data.userEmail).toBeNull();
    expect(data.entityId).toBeNull();
    expect(data.metadata).toBeUndefined();
  });

  it("never throws when the DB write fails", async () => {
    impl = () => Promise.reject(new Error("db down"));
    const orig = console.error; const spy = vi.fn(); console.error = spy;
    let thrown: unknown = null; try { await audit({ org: { id: "o1" } }, "LOGIN", "User", "u"); } catch (e) { thrown = e; }
    expect(thrown).toBeNull();
    expect(spy).toHaveBeenCalled();
    console.error = orig;
  });
});
