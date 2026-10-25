import { describe, it, expect, vi, beforeEach } from "vitest";

const project = vi.fn(), membership = vi.fn(), invitation = vi.fn();
vi.mock("@vectroq/db", () => ({
  prisma: {
    project: { count: (a: unknown) => project(a) },
    membership: { count: (a: unknown) => membership(a) },
    invitation: { count: (a: unknown) => invitation(a) },
  },
}));

import { getUsage } from "./usage";

beforeEach(() => { vi.useRealTimers(); [project, membership, invitation].forEach((m) => m.mockReset()); });

describe("getUsage", () => {
  it("sums members and pending invites as seats", async () => {
    project.mockResolvedValue(2); membership.mockResolvedValue(3); invitation.mockResolvedValue(1);
    await expect(getUsage("o1")).resolves.toEqual({ projectsThisMonth: 2, seatsUsed: 4 });
  });

  it("scopes queries by org, month start and unaccepted/unexpired invites", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-25T12:00:00Z"));
    project.mockResolvedValue(0); membership.mockResolvedValue(0); invitation.mockResolvedValue(0);
    await getUsage("o1");
    expect(project).toHaveBeenCalledWith({ where: { organizationId: "o1", createdAt: { gte: new Date("2026-10-01T00:00:00Z") } } });
    expect(membership).toHaveBeenCalledWith({ where: { organizationId: "o1" } });
    const w = invitation.mock.calls[0][0].where;
    expect(w.organizationId).toBe("o1");
    expect(w.acceptedAt).toBeNull();
    expect(w.expiresAt.gt).toEqual(new Date("2026-10-25T12:00:00Z"));
  });
});
