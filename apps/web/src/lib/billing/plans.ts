export type PlanId = "FREE" | "PRO" | "BUSINESS";

export interface PlanDef {
  id: PlanId;
  name: string;
  price: string;
  /** null = unlimited */
  projectsPerMonth: number | null;
  /** null = unlimited */
  seats: number | null;
  /** true = PDF carries the company's branding only, no "Prepared with Vectroq" footer */
  removeBranding: boolean;
}

export const PLANS: Record<PlanId, PlanDef> = {
  FREE: {
    id: "FREE",
    name: "Starter",
    price: "Free",
    projectsPerMonth: 3,
    seats: 1,
    removeBranding: false,
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    price: "Rs 4,999 / month",
    projectsPerMonth: null,
    seats: 5,
    removeBranding: true,
  },
  BUSINESS: {
    id: "BUSINESS",
    name: "Business",
    price: "Rs 14,999 / month",
    projectsPerMonth: null,
    seats: null,
    removeBranding: true,
  },
};

export const isPlanId = (v: unknown): v is PlanId =>
  typeof v === "string" && v in PLANS;

export const planOf = (org: { plan?: string | null }): PlanDef =>
  PLANS[isPlanId(org.plan) ? org.plan : "FREE"];