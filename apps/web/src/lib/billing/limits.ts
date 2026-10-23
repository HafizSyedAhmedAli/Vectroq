import type { PlanDef } from "./plans";

export interface Usage {
  projectsThisMonth: number;
  /** members + pending invitations */
  seatsUsed: number;
}

export function projectLimitError(plan: PlanDef, u: Usage): string | null {
  if (plan.projectsPerMonth === null) return null;
  if (u.projectsThisMonth < plan.projectsPerMonth) return null;
  return `The ${plan.name} plan allows ${plan.projectsPerMonth} projects per month. Upgrade your plan to create more.`;
}

export function seatLimitError(plan: PlanDef, u: Usage): string | null {
  if (plan.seats === null) return null;
  if (u.seatsUsed < plan.seats) return null;
  return `The ${plan.name} plan includes ${plan.seats} team member${plan.seats === 1 ? "" : "s"}. Upgrade your plan to invite more people.`;
}

/** First day of the current month, UTC. */
export function monthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}