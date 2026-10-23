import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/auth/guard";
import { appUrl } from "@/lib/app-url";
import { getStripe } from "@/lib/billing/stripe";

export async function POST(req: NextRequest) {
  const g = await guard("OWNER");
  if (!g.ok) return g.res;
  const customer = g.auth.org.stripeCustomerId;
  if (!customer) {
    return NextResponse.json(
      { error: "No billing account yet. Upgrade first." },
      { status: 400 },
    );
  }
  const session = await getStripe().billingPortal.sessions.create({
    customer,
    return_url: `${appUrl(req)}/office/billing`,
  });
  return NextResponse.json({ url: session.url });
}