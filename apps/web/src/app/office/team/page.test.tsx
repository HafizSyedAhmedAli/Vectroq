import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/org", () => ({
  requirePage: vi
    .fn()
    .mockResolvedValue({ org: { id: "org_1" }, user: { id: "u1" } }),
}));
vi.mock("@/components/TeamPanel", () => ({
  TeamPanel: (p: unknown) => <pre data-testid="panel">{JSON.stringify(p)}</pre>,
}));
vi.mock("@vectroq/db", () => ({
  prisma: {
    membership: { findMany: vi.fn() },
    invitation: { findMany: vi.fn() },
  },
}));

import { prisma } from "@vectroq/db";
import { requirePage } from "@/lib/org";
import TeamPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.membership.findMany as any).mockResolvedValue([
    {
      id: "m1",
      userId: "u1",
      role: "OWNER",
      user: { name: "Sara", email: "s@x.co" },
    },
    {
      id: "m2",
      userId: "u2",
      role: "VIEWER",
      user: { name: "Bilal", email: "b@x.co" },
    },
    {
      id: "m3",
      userId: "u3",
      role: "HACKER",
      user: { name: "Bad", email: "bad@x.co" },
    },
  ]);
  (prisma.invitation.findMany as any).mockResolvedValue([
    {
      id: "i1",
      email: "p@x.co",
      role: "ESTIMATOR",
      expiresAt: new Date("2026-11-01T00:00:00Z"),
    },
    {
      id: "i2",
      email: "q@x.co",
      role: "NOPE",
      expiresAt: new Date("2026-11-01T00:00:00Z"),
    },
  ]);
});

describe("Team page", () => {
  it("requires an owner and queries only this org's live invitations", async () => {
    await TeamPage();
    expect(requirePage).toHaveBeenCalledWith("OWNER");
    expect((prisma.membership.findMany as any).mock.calls[0][0].where).toEqual({
      organizationId: "org_1",
    });
    const inv = (prisma.invitation.findMany as any).mock.calls[0][0].where;
    expect(inv.organizationId).toBe("org_1");
    expect(inv.acceptedAt).toBeNull();
    expect(inv.expiresAt.gt).toBeInstanceOf(Date);
  });

  it("passes valid members and invites, flags you, and drops invalid roles", async () => {
    render(await TeamPage());
    const props = JSON.parse(screen.getByTestId("panel").textContent!);
    expect(props.members.map((m: any) => m.id)).toEqual(["m1", "m2"]);
    expect(props.members[0]).toMatchObject({
      name: "Sara",
      email: "s@x.co",
      isYou: true,
    });
    expect(props.members[1].isYou).toBe(false);
    expect(props.invites.map((i: any) => i.id)).toEqual(["i1"]);
    expect(typeof props.invites[0].expiresLabel).toBe("string");
  });
});
