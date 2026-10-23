import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@vectroq/db";
import { getStripe, planForPrice } from "@/lib/billing/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIVE = new Set(["active", "trialing", "past_due"]);

async function applySubscription(sub: Stripe.Subscription) {
  const item = sub.items.data[0];
  const plan = planForPrice(item?.price.id);
  const active = ACTIVE.has(sub.status) && plan !== null;
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  // Period end moved onto the subscription item in newer API versions.
  const periodEnd =
    (item as unknown as { current_period_end?: number })?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end;

  const data = {
    plan: active ? plan! : "FREE",
    planStatus: sub.status,
    planRenewsAt: periodEnd ? new Date(periodEnd * 1000) : null,
    stripeSubscriptionId: active ? sub.id : null,
  };

  const orgId = sub.metadata?.organizationId;
  await prisma.organization.updateMany({
    where: orgId ? { id: orgId } : { stripeCustomerId: customerId },
    data: { ...data, stripeCustomerId: customerId },
  });
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature) {
    return NextResponse.json({ error: "Not configured." }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "Bad signature." }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      if (typeof s.subscription === "string") {
        await applySubscription(await stripe.subscriptions.retrieve(s.subscription));
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await applySubscription(event.data.object as Stripe.Subscription);
      break;
  }

  return NextResponse.json({ received: true });
}