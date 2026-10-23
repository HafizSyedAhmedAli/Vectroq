// apps/web/src/components/intake/ProjectSummary.tsx
import type { Category, EngagementModel } from "@vectroq/shared-types";
import {
  Building2,
  FileText,
  Headset,
  Home,
  MapPin,
  Tag,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import type { CardOption } from "./OptionCards";
import type { IntakeFormValues } from "./types";

function SummaryRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 border-b border-stone-100 py-3.5 last:border-0">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-stone-500">{label}</p>
        <p className="truncate text-sm font-bold text-brand-black">
          {children}
        </p>
      </div>
    </div>
  );
}

export function ProjectSummary({
  values,
  modelOptions,
  categoryOptions,
}: {
  values: IntakeFormValues;
  modelOptions: CardOption<EngagementModel>[];
  categoryOptions: CardOption<Category>[];
}) {
  const model = modelOptions.find((m) => m.value === values.model);
  const none = "Not selected";
  return (
    <aside className="rounded-3xl border border-stone-200/70 bg-white p-6 shadow-xl shadow-stone-900/5 lg:sticky lg:top-6">
      <div className="mb-2 flex items-center gap-3 border-b border-stone-100 pb-4">
        <span className="grid size-10 place-items-center rounded-xl bg-brand/10 text-brand">
          <FileText className="size-5" />
        </span>
        <h3 className="text-lg font-bold text-brand-black">Your Project</h3>
      </div>

      <SummaryRow
        icon={<Building2 className="size-5" />}
        label="Engagement Model"
      >
        {model?.label ?? none}
      </SummaryRow>
      <SummaryRow icon={<MapPin className="size-5" />} label="City">
        {values.city || none}
      </SummaryRow>
      <SummaryRow icon={<Home className="size-5" />} label="House Type">
        {values.houseType ?? none}
      </SummaryRow>
      <SummaryRow icon={<Tag className="size-5" />} label="Material Category">
        {categoryOptions.find((c) => c.value === values.category)?.label ??
          none}
      </SummaryRow>
      <SummaryRow icon={<Wallet className="size-5" />} label="Budget Range">
        {values.budgetRange || none}
      </SummaryRow>

      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-brand/10 px-4 py-4 text-sm font-medium leading-snug text-brand-black">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-brand shadow-sm">
          <Headset className="size-5" />
        </span>
        Our representative will contact you shortly.
      </div>
    </aside>
  );
}
