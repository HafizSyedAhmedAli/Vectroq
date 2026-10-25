import { beforeEach, describe, expect, it, vi } from "vitest";

const getAuth = vi.fn();
vi.mock("./session", () => ({ getAuth: () => getAuth() }));

import { guard } from "./guard";

const ctx = (role: string) => ({
  user: { id: "u", email: "a@b.c", name: "A", emailVerified: true },
  org: { id: "o" },
  role,
});

describe("guard", () => {
  beforeEach(() => getAuth.mockReset());

  it("401 when not signed in", async () => {
    getAuth.mockResolvedValue(null);
    const r = await guard();
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.res.status).toBe(401);
      expect(await r.res.json()).toEqual({ error: "Sign in required." });
    }
  });
  it("403 when role is below minimum", async () => {
    getAuth.mockResolvedValue(ctx("VIEWER"));
    const r = await guard("ESTIMATOR");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.res.status).toBe(403);
  });
  it("ok when role meets minimum", async () => {
    getAuth.mockResolvedValue(ctx("OWNER"));
    const r = await guard("ESTIMATOR");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.auth.role).toBe("OWNER");
  });
  it("defaults to VIEWER minimum", async () => {
    getAuth.mockResolvedValue(ctx("VIEWER"));
    expect((await guard()).ok).toBe(true);
  });
});
