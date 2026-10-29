import Stripe from "stripe";
import type { PlanId } from "./plans";

let client: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return (client ??= new Stripe(key));
}

export const billingEnabled = () => !!process.env.STRIPE_SECRET_KEY;

export const PRICE_IDS = {
  get PRO() {
    return process.env.STRIPE_PRICE_PRO;
  },
  get BUSINESS() {
    return process.env.STRIPE_PRICE_BUSINESS;
  },
} as Record<"PRO" | "BUSINESS", string | undefined>;

export function planForPrice(priceId: string | undefined): PlanId | null {
  if (!priceId) return null;
  if (priceId === PRICE_IDS.PRO) return "PRO";
  if (priceId === PRICE_IDS.BUSINESS) return "BUSINESS";
  return null;
}
