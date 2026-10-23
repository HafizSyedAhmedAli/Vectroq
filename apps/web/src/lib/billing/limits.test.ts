import { describe, it, expect } from "vitest";
import { PLANS, planOf } from "./plans";
import { monthStart, projectLimitError, seatLimitError } from "./limits";

describe("plan limits", () => {
  it("blocks the 4th project on Free", () => {
    expect(projectLimitError(PLANS.FREE, { projectsThisMonth: 2, seatsUsed: 1 })).toBeNull();
    expect(projectLimitError(PLANS.FREE, { projectsThisMonth: 3, seatsUsed: 1 })).toMatch(/3 projects/);
  });
  it("never limits projects on Pro", () => {
    expect(projectLimitError(PLANS.PRO, { projectsThisMonth: 999, seatsUsed: 1 })).toBeNull();
  });
  it("counts pending invites as seats", () => {
    expect(seatLimitError(PLANS.FREE, { projectsThisMonth: 0, seatsUsed: 1 })).toMatch(/1 team member/);
    expect(seatLimitError(PLANS.PRO, { projectsThisMonth: 0, seatsUsed: 4 })).toBeNull();
    expect(seatLimitError(PLANS.PRO, { projectsThisMonth: 0, seatsUsed: 5 })).not.toBeNull();
    expect(seatLimitError(PLANS.BUSINESS, { projectsThisMonth: 0, seatsUsed: 500 })).toBeNull();
  });
  it("falls back to Free for unknown or missing plans", () => {
    expect(planOf({ plan: "nope" }).id).toBe("FREE");
    expect(planOf({}).id).toBe("FREE");
  });
  it("month starts on the 1st (UTC)", () => {
    expect(monthStart(new Date("2026-10-23T12:00:00Z")).toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
});