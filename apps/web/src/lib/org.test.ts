import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const redirect = vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); });
const getAuth = vi.fn();
vi.mock("react", () => ({ cache: <T,>(fn: T) => fn }));
vi.mock("next/navigation", () => ({ redirect: (u: string) => redirect(u) }));
vi.mock("@vectroq/db", () => ({ prisma: { organization: { findUnique: (a: unknown) => findUnique(a) } } }));
vi.mock("@/lib/auth/session", () => ({ getAuth: () => getAuth() }));

import { getOrgBySlug, requirePage, getCurrentOrg, DEFAULT_ORG_SLUG } from "./org";

beforeEach(() => { findUnique.mockReset(); getAuth.mockReset(); redirect.mockClear(); });

describe("org helpers", () => {
  it("has a default slug", () => expect(typeof DEFAULT_ORG_SLUG).toBe("string"));

  it("getOrgBySlug trims and lowercases the slug", async () => {
    findUnique.mockResolvedValue({ id: "o" });
    await getOrgBySlug("  AcMe ");
    expect(findUnique).toHaveBeenCalledWith({ where: { slug: "acme" } });
  });

  it("requirePage redirects to /login when signed out", async () => {
    getAuth.mockResolvedValue(null);
    await expect(requirePage()).rejects.toThrow("REDIRECT:/login");
  });

  it("requirePage redirects to /office when role is too low", async () => {
    getAuth.mockResolvedValue({ role: "VIEWER", org: {} });
    await expect(requirePage("OWNER")).rejects.toThrow("REDIRECT:/office");
  });

  it("requirePage returns the auth context when role is enough", async () => {
    const auth = { role: "ESTIMATOR", org: { id: "o" } };
    getAuth.mockResolvedValue(auth);
    await expect(requirePage("ESTIMATOR")).resolves.toBe(auth);
    await expect(requirePage()).resolves.toBe(auth);
  });

  it("getCurrentOrg returns the org of the signed-in user", async () => {
    getAuth.mockResolvedValue({ role: "VIEWER", org: { id: "o9" } });
    await expect(getCurrentOrg()).resolves.toEqual({ id: "o9" });
  });
});
