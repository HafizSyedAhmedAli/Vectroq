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
    <div className="flex items-center gap-3 rounded-lg border border-stone-100 px-3 py-2.5">
      <span className="size-8 rounded-full bg-stone-100 grid place-items-center text-brand-black shrink-0">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-stone-500">{label}</p>
        <p className="text-xs font-medium text-brand-black truncate">
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
    <aside className="bg-white border border-stone-200 rounded-2xl shadow-sm p-5 space-y-3 lg:sticky lg:top-6">
      <div className="flex items-center gap-3 pb-3 border-b border-stone-100">
        <span className="size-9 rounded-lg bg-stone-100 grid place-items-center">
          <FileText className="size-4 text-brand-black" />
        </span>
        <h3 className="font-semibold text-brand-black">Your Project</h3>
      </div>

      <SummaryRow
        icon={<Building2 className="size-4" />}
        label="Engagement Model"
      >
        {model?.label ?? none}
      </SummaryRow>
      <SummaryRow icon={<MapPin className="size-4" />} label="City">
        {values.city || none}
      </SummaryRow>
      <SummaryRow icon={<Home className="size-4" />} label="House Type">
        {values.houseType ?? none}
      </SummaryRow>
      <SummaryRow icon={<Tag className="size-4" />} label="Material Category">
        {categoryOptions.find((c) => c.value === values.category)?.label ??
          none}
      </SummaryRow>
      <SummaryRow icon={<Wallet className="size-4" />} label="Budget Range">
        {values.budgetRange || none}
      </SummaryRow>

      <div className="flex items-center gap-3 rounded-lg bg-red-50 px-3 py-3 text-sm text-brand">
        <Headset className="size-5 shrink-0" />
        Our representative will contact you shortly.
      </div>
    </aside>
  );
}
