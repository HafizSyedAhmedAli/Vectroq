import { beforeEach, describe, expect, it, vi } from "vitest";

const jar = vi.hoisted(() => ({ set: vi.fn(), get: vi.fn(), delete: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => jar }));
vi.mock("react", async (orig) => ({
  ...(await orig<typeof import("react")>()),
  cache: <T,>(fn: T) => fn,
}));
const prisma = vi.hoisted(() => ({
  session: { create: vi.fn(), deleteMany: vi.fn(), findUnique: vi.fn() },
  membership: { findUnique: vi.fn() },
}));
vi.mock("@vectroq/db", () => ({ prisma }));

import { createSession, destroySession, getAuth, SESSION_COOKIE } from "./session";
import { sha256 } from "./tokens";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createSession", () => {
  it("stores hashed token and sets persistent cookie when remember", async () => {
    await createSession("u1", "o1");
    const data = prisma.session.create.mock.calls[0][0].data;
    const [name, token, opts] = jar.set.mock.calls[0];
    expect(name).toBe(SESSION_COOKIE);
    expect(data.id).toBe(sha256(token));
    expect(data.id).not.toBe(token);
    expect(opts).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 2592000 });
    expect(data.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 86400e3);
  });
  it("uses a 1-day session cookie without maxAge when remember=false", async () => {
    await createSession("u1", "o1", false);
    const data = prisma.session.create.mock.calls[0][0].data;
    expect(jar.set.mock.calls[0][2]).not.toHaveProperty("maxAge");
    expect(data.expiresAt.getTime()).toBeLessThan(Date.now() + 86401e3);
  });
  it("sets secure flag only in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await createSession("u", "o");
    expect(jar.set.mock.calls[0][2].secure).toBe(true);
    vi.unstubAllEnvs();
  });
});

describe("destroySession", () => {
  it("deletes the DB session and cookie", async () => {
    jar.get.mockReturnValue({ value: "tok" });
    await destroySession();
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { id: sha256("tok") } });
    expect(jar.delete).toHaveBeenCalledWith(SESSION_COOKIE);
  });
  it("only clears the cookie when none present", async () => {
    jar.get.mockReturnValue(undefined);
    await destroySession();
    expect(prisma.session.deleteMany).not.toHaveBeenCalled();
    expect(jar.delete).toHaveBeenCalled();
  });
});

describe("getAuth", () => {
  const session = {
    userId: "u",
    organizationId: "o",
    expiresAt: new Date(Date.now() + 1e6),
    user: { id: "u", email: "a@b.c", name: "A", emailVerifiedAt: new Date() },
  };
  beforeEach(() => jar.get.mockReturnValue({ value: "tok" }));

  it("null without cookie", async () => {
    jar.get.mockReturnValue(undefined);
    expect(await getAuth()).toBeNull();
    expect(prisma.session.findUnique).not.toHaveBeenCalled();
  });
  it("null when session missing or expired", async () => {
    prisma.session.findUnique.mockResolvedValue(null);
    expect(await getAuth()).toBeNull();
    prisma.session.findUnique.mockResolvedValue({ ...session, expiresAt: new Date(Date.now() - 1) });
    expect(await getAuth()).toBeNull();
  });
  it("null when membership missing or role invalid", async () => {
    prisma.session.findUnique.mockResolvedValue(session);
    prisma.membership.findUnique.mockResolvedValue(null);
    expect(await getAuth()).toBeNull();
    prisma.membership.findUnique.mockResolvedValue({ role: "HACKER", organization: {} });
    expect(await getAuth()).toBeNull();
  });
  it("returns context with fresh role and emailVerified flag", async () => {
    prisma.session.findUnique.mockResolvedValue(session);
    prisma.membership.findUnique.mockResolvedValue({ role: "OWNER", organization: { id: "o" } });
    expect(await getAuth()).toEqual({
      user: { id: "u", email: "a@b.c", name: "A", emailVerified: true },
      org: { id: "o" },
      role: "OWNER",
    });
    prisma.session.findUnique.mockResolvedValue({ ...session, user: { ...session.user, emailVerifiedAt: null } });
    expect((await getAuth())?.user.emailVerified).toBe(false);
  });
});
