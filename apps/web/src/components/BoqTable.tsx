import {
  BrickWall,
  Calculator,
  Layers,
  Package,
  PaintRoller,
  Wrench,
} from "lucide-react";
import type { BOQResult } from "@tmcc/shared-types";
import {
  BOQ_META,
  formatPkr,
  formatQty,
  groupBoq,
  taxPercent,
  unitLabel,
  type Group,
} from "@/lib/boq-format";
import { rateBasisLine } from "@/lib/rate-basis";

const num = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

const GROUP_ICON: Record<Group, React.ComponentType<{ className?: string }>> = {
  Structure: Layers,
  "Masonry & Plaster": BrickWall,
  Finishes: PaintRoller,
  "Services & Fixtures": Wrench,
  Materials: Package,
};

// Presentational only (no hooks) so it works in server and client components.
export function BoqTable({ boq }: { boq: BOQResult }) {
  const groups = groupBoq(boq);
  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-stone-600 text-xs font-semibold">
            <tr className="border-b border-stone-200">
              <th className="text-left px-4 py-3">Item</th>
              <th className="text-right px-4 py-3">Quantity</th>
              <th className="text-right px-4 py-3">Rate (Rs)</th>
              <th className="text-right px-4 py-3">Amount (Rs)</th>
            </tr>
          </thead>
          {groups.map((g) => {
            const Icon = GROUP_ICON[g.group];
            return (
              <tbody key={g.group} className="break-inside-avoid">
                <tr className="bg-stone-100/70">
                  <td
                    colSpan={4}
                    className="px-4 py-2 text-xs font-semibold text-brand-black"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon className="size-4" />
                      {g.group}
                    </span>
                  </td>
                </tr>
                {g.items.map((item) => (
                  <tr key={item.itemType} className="border-t border-stone-100">
                    <td className="px-4 py-2 text-stone-700">
                      {BOQ_META[item.itemType]?.label ?? item.itemType}
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap text-stone-700">
                      {formatQty(item)}{" "}
                      <span className="text-stone-400">
                        {unitLabel(item.unit)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-stone-700">
                      {num.format(item.unitRate)}
                    </td>
                    <td className="px-4 py-2 text-right text-stone-700">
                      {num.format(item.subtotal)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-stone-200">
                  <td
                    colSpan={3}
                    className="px-4 py-2 text-right text-xs font-medium text-stone-600"
                  >
                    {g.group} subtotal
                  </td>
                  <td className="px-4 py-2 text-right font-bold text-brand-black">
                    {num.format(g.subtotal)}
                  </td>
                </tr>
              </tbody>
            );
          })}
        </table>
      </div>

      {/* Totals */}
      <div className="mt-4 rounded-xl bg-brand-black text-white px-5 py-4 flex items-center gap-4 break-inside-avoid">
        <Calculator className="size-8 text-white/80 shrink-0" />
        <dl className="ml-auto w-full max-w-sm text-sm">
          <div className="flex justify-between py-0.5">
            <dt className="text-white/80">Subtotal</dt>
            <dd>{formatPkr(boq.subtotal)}</dd>
          </div>
          <div className="flex justify-between py-0.5">
            <dt className="text-white/80">Sales tax ({taxPercent(boq)}%)</dt>
            <dd>{formatPkr(boq.tax)}</dd>
          </div>
          <div className="mt-2 pt-2 border-t border-white/20 flex justify-between items-baseline">
            <dt className="font-semibold">Total estimated cost</dt>
            <dd className="text-lg font-bold">{formatPkr(boq.total)}</dd>
          </div>
        </dl>
      </div>

      {boq.rateBasis && (
        <p
          className={`mt-3 text-xs ${
            boq.rateBasis.isFallback
              ? "font-medium text-amber-700"
              : "text-stone-500"
          }`}
        >
          {rateBasisLine(boq.rateBasis)}
        </p>
      )}
    </div>
  );
}
