import { CreditCard } from "lucide-react";
import { BillingPanel } from "@/components/BillingPanel";
import { PLANS, planOf } from "@/lib/billing/plans";
import { billingEnabled } from "@/lib/billing/stripe";
import { getUsage } from "@/lib/billing/usage";
import { requirePage } from "@/lib/org";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { org } = await requirePage("OWNER");
  const { status } = await searchParams;
  const plan = planOf(org);
  const usage = await getUsage(org.id);

  return (
    <main className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-blue-50/40 to-white pb-16">
      <div className="mx-auto max-w-5xl px-4 pt-10 sm:px-6">
        <div className="flex items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-blue-50 text-brand">
            <CreditCard className="size-6" />
          </span>
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-brand-black">
              Plans &amp; billing
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              You are on the <b>{plan.name}</b> plan.
              {org.planRenewsAt &&
                ` Renews ${org.planRenewsAt.toLocaleDateString("en-PK", { dateStyle: "medium" })}.`}
            </p>
          </div>
        </div>

        <div className="mt-8">
          <BillingPanel
            currentPlan={plan.id}
            hasSubscription={!!org.stripeCustomerId}
            billingEnabled={billingEnabled()}
            isDemo={org.isDemo}
            flash={status === "success" || status === "cancelled" ? status : null}
            usage={{
              projects: usage.projectsThisMonth,
              projectLimit: plan.projectsPerMonth,
              seats: usage.seatsUsed,
              seatLimit: plan.seats,
            }}
            plans={Object.values(PLANS).map((p) => ({
              id: p.id,
              name: p.name,
              price: p.price,
              features: [
                p.projectsPerMonth === null
                  ? "Unlimited projects"
                  : `${p.projectsPerMonth} projects per month`,
                p.seats === null
                  ? "Unlimited team members"
                  : `${p.seats} team member${p.seats === 1 ? "" : "s"}`,
                p.removeBranding
                  ? "No Vectroq branding on PDFs"
                  : "PDF carries a Vectroq footer",
              ],
            }))}
          />
        </div>
      </div>
    </main>
  );
}