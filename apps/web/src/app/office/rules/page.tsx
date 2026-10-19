import { SlidersHorizontal } from "lucide-react";
import { resolveOrgRules } from "@vectroq/shared-types";
import { RulesForm } from "@/components/RulesForm";
import { requirePage } from "@/lib/org";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const { org } = await requirePage("OWNER");
  return (
    <main className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-blue-50/40 to-white pb-16">
      <div className="mx-auto max-w-5xl px-4 pt-10 sm:px-6">
        <div className="flex items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-blue-50 text-brand">
            <SlidersHorizontal className="size-6" />
          </span>
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-brand-black">
              Business Rules
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-stone-500">
              Service types, tax, labour rates, drawing assumptions and BOQ
              notes. Changes apply to new BOQs; saved BOQs keep their prices
              until recalculated.
            </p>
          </div>
        </div>
        <div className="mt-8">
          <RulesForm initial={resolveOrgRules(org.rules)} />
        </div>
      </div>
    </main>
  );
}
