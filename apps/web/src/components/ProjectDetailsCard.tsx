// apps/web/src/components/ProjectDetailsCard.tsx
import type { ReactNode } from "react";
import {
  BriefcaseBusiness,
  ChevronRight,
  ClipboardList,
  Headset,
  Home,
  MapPin,
  Phone,
  Wallet,
} from "lucide-react";

function Row({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-stone-100 bg-white px-3 py-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-red-100 bg-white text-brand">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-brand-black">{label}</p>
        <p className="truncate text-xs text-stone-500">{value}</p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-stone-400" />
    </div>
  );
}

export function ProjectDetailsCard({
  modelLabel,
  city,
  houseType,
  contact,
  budgetRange,
}: {
  modelLabel: string;
  city: string;
  houseType: string;
  contact: string;
  budgetRange: string | null;
}) {
  return (
    <aside className="rounded-2xl border border-stone-200/70 bg-white/95 p-5 shadow-[0_10px_40px_-12px_rgba(35,31,30,0.12)] backdrop-blur">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-lg bg-brand text-white">
          <ClipboardList className="size-4" />
        </span>
        <h2 className="font-semibold text-brand-black">Project Details</h2>
      </div>

      <div className="space-y-2.5">
        <Row
          icon={<BriefcaseBusiness className="size-5" />}
          label="Engagement Model"
          value={modelLabel}
        />
        <Row icon={<MapPin className="size-5" />} label="City" value={city} />
        <Row
          icon={<Home className="size-5" />}
          label="House Type"
          value={houseType}
        />
        <Row
          icon={<Phone className="size-5" />}
          label="Client Contact"
          value={contact}
        />
        {budgetRange && (
          <Row
            icon={<Wallet className="size-5" />}
            label="Client Budget"
            value={budgetRange}
          />
        )}
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-xl bg-red-50 px-4 py-4 text-sm font-medium leading-snug text-brand">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-brand shadow-sm">
          <Headset className="size-5" />
        </span>
        Our representative will contact you shortly.
      </div>
    </aside>
  );
}
