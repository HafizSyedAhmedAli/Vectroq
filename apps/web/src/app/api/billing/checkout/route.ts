import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vectroq/db";
import { guard } from "@/lib/auth/guard";
import { appUrl } from "@/lib/app-url";
import { getStripe, PRICE_IDS } from "@/lib/billing/stripe";

export async function POST(req: NextRequest) {
  const g = await guard("OWNER");
  if (!g.ok) return g.res;
  const org = g.auth.org;

  if (org.isDemo) {
    return NextResponse.json(
      { error: "Create a real company to upgrade." },
      { status: 403 },
    );
  }

  const b = await req.json().catch(() => null);
  const plan = b?.plan;
  if (plan !== "PRO" && plan !== "BUSINESS") {
    return NextResponse.json({ error: "Choose a plan." }, { status: 400 });
  }
  const price = PRICE_IDS[plan as "PRO" | "BUSINESS"];
  if (!price) {
    return NextResponse.json(
      { error: "Billing is not configured yet." },
      { status: 503 },
    );
  }
  if (org.stripeSubscriptionId && org.plan !== "FREE") {
    return NextResponse.json(
      { error: "You already have a subscription. Use Manage billing to change it." },
      { status: 409 },
    );
  }

  const stripe = getStripe();
  let customerId = org.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: g.auth.user.email,
      name: org.name,
      metadata: { organizationId: org.id },
    });
    customerId = customer.id;
    await prisma.organization.update({
      where: { id: org.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const base = appUrl(req);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price, quantity: 1 }],
    client_reference_id: org.id,
    metadata: { organizationId: org.id },
    subscription_data: { metadata: { organizationId: org.id } },
    success_url: `${base}/office/billing?status=success`,
    cancel_url: `${base}/office/billing?status=cancelled`,
  });

  return NextResponse.json({ url: session.url });
}