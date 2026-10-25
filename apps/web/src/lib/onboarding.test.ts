import { describe, it, expect, vi, beforeEach } from "vitest";

const rateCount = vi.fn(), leadCount = vi.fn(), projFirst = vi.fn(), cadMany = vi.fn();
vi.mock("@vectroq/db", () => ({
  prisma: {
    rateSet: { count: (a: unknown) => rateCount(a) },
    lead: { count: (a: unknown) => leadCount(a) },
    project: { findFirst: (a: unknown) => projFirst(a) },
    cadFile: { findMany: (a: unknown) => cadMany(a) },
  },
}));

import { getOnboardingSteps } from "./onboarding";

const org = (o: object = {}) => ({ id: "o1", slug: "acme", tagline: null, phone: null, logoUrl: null, offices: [], ...o }) as never;
const setup = (p: { rates?: number; leads?: number; project?: { id: string } | null; cads?: { projectId: string; boq: unknown }[] }) => {
  rateCount.mockResolvedValue(p.rates ?? 0);
  leadCount.mockResolvedValue(p.leads ?? 0);
  projFirst.mockResolvedValue(p.project ?? null);
  cadMany.mockResolvedValue(p.cads ?? []);
};
const byId = (steps: { id: string }[]) => Object.fromEntries(steps.map((s) => [s.id, s])) as Record<string, any>;

beforeEach(() => [rateCount, leadCount, projFirst, cadMany].forEach((m) => m.mockReset()));

describe("getOnboardingSteps", () => {
  it("returns six steps in order, all pending for a fresh org", async () => {
    setup({});
    const steps = await getOnboardingSteps(org());
    expect(steps.map((s) => s.id)).toEqual(["branding", "rates", "lead", "project", "drawing", "boq"]);
    expect(steps.every((s) => !s.done)).toBe(true);
    const m = byId(steps);
    expect(m.lead.href).toBe("/c/acme");
    expect(m.lead.external).toBe(true);
    expect(m.drawing.href).toBe("/office/leads");
    expect(m.boq.href).toBe("/office/leads");
  });

  it("queries scoped to the org (approved rate sets, oldest project)", async () => {
    setup({});
    await getOnboardingSteps(org());
    expect(rateCount).toHaveBeenCalledWith({ where: { organizationId: "o1", status: "APPROVED" } });
    expect(projFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "o1" }, orderBy: { createdAt: "asc" } }));
  });

  it.each([
    [{ tagline: "Hi" }], [{ phone: "1" }], [{ logoUrl: "http://l" }], [{ offices: [{ title: "a", address: "b" }] }],
  ])("branding is done with %j", async (extra) => {
    setup({});
    expect(byId(await getOnboardingSteps(org(extra)))["branding"].done).toBe(true);
  });

  it("branding is not done when offices is not an array", async () => {
    setup({});
    expect(byId(await getOnboardingSteps(org({ offices: null })))["branding"].done).toBe(false);
  });

  it("marks rates, lead and project done from counts", async () => {
    setup({ rates: 1, leads: 2, project: { id: "p1" } });
    const m = byId(await getOnboardingSteps(org()));
    expect(m.rates.done && m.lead.done && m.project.done).toBe(true);
    expect(m.drawing.done).toBe(false);
    expect(m.drawing.href).toBe("/office/p1");
  });

  it("drawing done but BOQ pending links to the project missing a BOQ", async () => {
    setup({ project: { id: "p1" }, cads: [{ projectId: "p2", boq: null }] });
    const m = byId(await getOnboardingSteps(org()));
    expect(m.drawing.done).toBe(true);
    expect(m.boq.done).toBe(false);
    expect(m.boq.href).toBe("/office/p2");
  });

  it("boq is done when any cad file has a BOQ", async () => {
    setup({ project: { id: "p1" }, cads: [{ projectId: "p1", boq: { total: 1 } }, { projectId: "p2", boq: null }] });
    const m = byId(await getOnboardingSteps(org()));
    expect(m.boq.done).toBe(true);
  });
});
