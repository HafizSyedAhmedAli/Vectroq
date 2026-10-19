import { Clock, SlidersHorizontal } from "lucide-react";
import { resolveOrgRules } from "@vectroq/shared-types";
import { RulesForm } from "@/components/RulesForm";
import { requirePage } from "@/lib/org";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const { org } = await requirePage("OWNER");
  const updated = org.updatedAt.toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <main className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-stone-50 to-white pb-10">
      <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
        {/* Header card */}
        <section className="relative overflow-hidden rounded-2xl border border-stone-200/70 bg-gradient-to-r from-[color-mix(in_srgb,var(--color-brand)_8%,white)] via-white to-[color-mix(in_srgb,var(--color-brand)_6%,white)] p-5 shadow-[0_10px_40px_-12px_rgba(15,23,42,0.10)] sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand">
                <SlidersHorizontal className="size-7" />
              </span>
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand">
                  <SlidersHorizontal className="size-3" /> Business Rules
                </span>
                <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-brand-black">
                  Business Rules
                </h1>
                <p className="mt-1 max-w-xl text-sm text-stone-500">
                  Service types, tax, labour rates, drawing assumptions and BOQ
                  notes. Changes apply to new BOQs. Saved BOQs keep their prices
                  until recalculated.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-stone-200/70 bg-white px-4 py-3 shadow-sm">
              <Clock className="size-5 text-brand" />
              <div>
                <p className="text-[11px] font-semibold text-stone-500">
                  Last updated
                </p>
                <p className="text-sm font-medium text-brand-black">
                  {updated}
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6">
          <RulesForm initial={resolveOrgRules(org.rules)} />
        </div>
      </div>
    </main>
  );
}
