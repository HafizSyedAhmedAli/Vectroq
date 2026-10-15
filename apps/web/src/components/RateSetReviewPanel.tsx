"use client";

import { Fragment, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ChevronDown,
  CircleCheck,
  FileText,
  Info,
  Layers,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Tag,
  User,
} from "lucide-react";
import { CITY_NAMES, type RateCardItem } from "@tmcc/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { BOQ_META, unitLabel } from "@/lib/boq-format";
import type {
  ApprovedRateSet,
  DraftRateSet,
  RateSources,
} from "@/lib/rate-set-types";
import { CsrImportForm } from "./CsrImportForm";

// Category is a material grade tier (see GRADE_HINT in @tmcc/rate-research).
const CATEGORY_META: Record<
  string,
  { label: string; badge: string; chip: string }
> = {
  A: {
    label: "Premium",
    badge: "bg-blue-100 text-blue-700",
    chip: "bg-blue-50 text-blue-700",
  },
  B: {
    label: "Standard",
    badge: "bg-red-100 text-brand",
    chip: "bg-red-50 text-brand",
  },
  C: {
    label: "Economy",
    badge: "bg-purple-100 text-purple-700",
    chip: "bg-purple-50 text-purple-700",
  },
};

const pkr = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 2 });

const fieldWrap =
  "w-full cursor-pointer [&_select]:h-11 [&_select]:rounded-xl [&_select]:border-stone-200 [&_select]:bg-white [&_select]:pl-10 [&_select]:text-[15px] [&_select]:text-brand-black [&_select]:shadow-sm [&_select:focus-visible]:border-brand [&_select:focus-visible]:ring-brand/20";
const inputCls =
  "h-11 rounded-xl border-stone-200! bg-white! pl-10 text-[15px] text-brand-black shadow-sm focus-visible:border-brand! focus-visible:ring-brand/20";

function IconField({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="relative mt-1.5">
      <span className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-stone-500">
        {icon}
      </span>
      {children}
    </div>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const meta = CATEGORY_META[category];
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`grid size-7 place-items-center rounded-full text-xs font-bold ${meta?.badge ?? "bg-stone-100 text-stone-600"}`}
      >
        {category}
      </span>
      <span
        className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${meta?.chip ?? "bg-stone-50 text-stone-600"}`}
      >
        {category} ({meta?.label ?? "Custom"})
      </span>
    </span>
  );
}

function ApprovedPill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
      <CircleCheck className="size-3.5" /> Approved
    </span>
  );
}

function SourceCell({
  sources,
  itemType,
}: {
  sources: RateSources | null;
  itemType: string;
}) {
  const src = sources?.items?.find((s) => s.itemType === itemType);

  if (!src?.sourceUrl && sources?.document) {
    return (
      <span className="text-right text-xs text-stone-500">
        {sources.document}
        {sources.year ? ` ${sources.year}` : ""}
      </span>
    );
  }

  return (
    <span className="text-right text-xs text-stone-500">
      {src?.sourceUrl ? (
        <a
          href={src.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-brand underline"
        >
          {src.sourceName ?? "source"}
        </a>
      ) : (
        "manual entry"
      )}
      {src?.sourceDate && ` · ${src.sourceDate}`}
    </span>
  );
}

// FR-15 / NFR-4: nothing reaches a BOQ until it is an APPROVED rate set,
// either imported from a CSR or entered manually and approved here.
export function RateSetReviewPanel({
  initialDrafts,
  approved,
}: {
  initialDrafts: DraftRateSet[];
  approved: ApprovedRateSet[];
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState(initialDrafts);

  // Form values vs. the filter that is actually applied (button / Enter).
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [applied, setApplied] = useState({ city: "", category: "" });
  const [approvedBy, setApprovedBy] = useState("");

  const [edits, setEdits] = useState<Record<string, Record<string, string>>>(
    {},
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const rows = approved.filter(
    (a) =>
      (!applied.city || a.city.toLowerCase() === applied.city.toLowerCase()) &&
      (!applied.category || a.category === applied.category),
  );
  const latest = rows[0];
  // Every known city, plus any city that already has approved rates.
  const cityOptions = [
    ...new Set([...CITY_NAMES, ...approved.map((a) => a.city)]),
  ];

  async function call(url: string, body?: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Request failed");
    return data;
  }

  function search(e: FormEvent) {
    e.preventDefault();
    setApplied({ city: city.trim(), category });
  }

  async function approve(d: DraftRateSet) {
    if (!approvedBy.trim()) {
      setError("Enter your name in “Approved By” first.");
      document.getElementById("rs-by")?.focus();
      return;
    }
    setBusy(d.id);
    setError(null);
    setNotice(null);
    try {
      const items = d.items.map((i) => ({
        ...i,
        unitRate: Number(edits[d.id]?.[i.itemType] ?? i.unitRate),
      }));
      await call(`/api/rate-sets/${d.id}/approve`, { approvedBy, items });
      setDrafts((prev) => prev.filter((x) => x.id !== d.id));
      setNotice(
        `Approved ${d.city} · Category ${d.category}. BOQs now use it.`,
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setBusy(null);
    }
  }

  async function reject(d: DraftRateSet) {
    setBusy(d.id);
    setError(null);
    setNotice(null);
    try {
      await call(`/api/rate-sets/${d.id}/reject`);
      setDrafts((prev) => prev.filter((x) => x.id !== d.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-3xl border border-stone-200/70 bg-white shadow-[0_10px_40px_-12px_rgba(35,31,30,0.15)]">
        {/* Find your rate */}
        <div className="p-3 sm:p-4">
          <form
            onSubmit={search}
            className="rounded-2xl bg-gradient-to-b from-red-50/70 to-white p-5 sm:p-6"
          >
            <div className="flex items-center gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand text-white shadow-md shadow-brand/30">
                <FileText className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-brand-black">
                  Find Your Rate
                </h2>
                <p className="text-sm text-stone-500">
                  Get the latest approved rates for your selected location and
                  category.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
              <div>
                <Label htmlFor="rs-city" className="text-[13px] font-semibold">
                  City
                </Label>
                <IconField icon={<MapPin className="size-4" />}>
                  <NativeSelect
                    id="rs-city"
                    className={fieldWrap}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  >
                    <NativeSelectOption value="">All cities</NativeSelectOption>
                    {cityOptions.map((c) => (
                      <NativeSelectOption key={c} value={c}>
                        {c}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </IconField>
              </div>
              <div>
                <Label htmlFor="rs-cat" className="text-[13px] font-semibold">
                  Category
                </Label>
                <IconField icon={<Tag className="size-4" />}>
                  <NativeSelect
                    id="rs-cat"
                    className={fieldWrap}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <NativeSelectOption value="">
                      All categories
                    </NativeSelectOption>
                    <NativeSelectOption value="A">
                      A (Premium)
                    </NativeSelectOption>
                    <NativeSelectOption value="B">
                      B (Standard)
                    </NativeSelectOption>
                    <NativeSelectOption value="C">
                      C (Economy)
                    </NativeSelectOption>
                  </NativeSelect>
                </IconField>
              </div>
              <div>
                <Label htmlFor="rs-by" className="text-[13px] font-semibold">
                  Approved By
                </Label>
                <IconField icon={<User className="size-4" />}>
                  <Input
                    id="rs-by"
                    className={inputCls}
                    value={approvedBy}
                    onChange={(e) => setApprovedBy(e.target.value)}
                    placeholder="Your name"
                  />
                </IconField>
              </div>
              <Button
                type="submit"
                className="h-11 cursor-pointer gap-2 rounded-xl bg-brand px-6 text-[15px] font-semibold text-white shadow-md shadow-brand/25 hover:bg-brand-dark md:col-span-2 lg:col-span-1"
              >
                <Search className="size-4" />
                Search Rates
                <ArrowRight className="size-4" />
              </Button>
            </div>

            <p className="mt-4 border-t border-red-100/70 pt-4 text-xs text-stone-500">
              “Approved By” is the reviewer name saved when you approve a draft
              below.
            </p>

            {error && (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {error}
              </p>
            )}
            {notice && (
              <p
                role="status"
                className="mt-3 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
              >
                <CircleCheck className="size-4 shrink-0" /> {notice}
              </p>
            )}
          </form>
        </div>

        {/* Available rates */}
        <div className="px-5 pb-6 pt-2 sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-6">
            <div className="flex items-center gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand text-white shadow-md shadow-brand/30">
                <Layers className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-brand-black">
                  Available Rates
                </h2>
                <p className="text-sm text-stone-500">
                  Showing approved rates for {applied.city || "all cities"} ·{" "}
                  {applied.category
                    ? `Category ${applied.category}`
                    : "all categories"}
                </p>
              </div>
            </div>
            {latest && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500">
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="size-3.5" /> Last updated:{" "}
                  {latest.approvedLabel}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1 font-medium text-green-700">
                  <CircleCheck className="size-3.5" /> Approved by{" "}
                  {latest.approvedBy}
                </span>
              </div>
            )}
          </div>

          <div className="mt-5 overflow-x-auto rounded-2xl border border-stone-200 bg-white">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-stone-50 text-xs font-semibold text-stone-500">
                <tr>
                  <th className="px-5 py-3 text-left">City</th>
                  <th className="px-3 py-3 text-left">Category</th>
                  <th className="px-3 py-3 text-left">Rates</th>
                  <th className="px-3 py-3 text-left">Approved By</th>
                  <th className="px-3 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-12 text-center text-sm text-stone-400"
                    >
                      No approved rates match this search. Import a CSR below or
                      approve a manual draft.
                    </td>
                  </tr>
                )}
                {rows.map((a) => {
                  const open = openId === a.id;
                  const cement = a.items.find((i) => i.itemType === "cement");
                  return (
                    <Fragment key={a.id}>
                      <tr className="border-t border-stone-100">
                        <td className="px-5 py-4">
                          <span className="flex items-center gap-2 font-medium text-brand-black">
                            <MapPin className="size-4 text-brand" /> {a.city}
                          </span>
                        </td>
                        <td className="px-3 py-4">
                          <CategoryBadge category={a.category} />
                        </td>
                        <td className="px-3 py-4">
                          <p className="font-semibold text-brand-black">
                            {a.items.length} rates
                          </p>
                          <p className="text-xs text-stone-400">
                            {cement
                              ? `Cement Rs ${pkr.format(cement.unitRate)} / ${unitLabel(cement.unit)}`
                              : "per BOQ line item"}
                          </p>
                        </td>
                        <td className="px-3 py-4">
                          <span className="flex items-center gap-2">
                            <User className="size-4 text-brand-black" />
                            <span>
                              <span className="block font-medium text-brand-black">
                                {a.approvedBy}
                              </span>
                              <span className="block text-xs text-stone-400">
                                {a.approvedLabel}
                              </span>
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-4">
                          <ApprovedPill />
                        </td>
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            aria-expanded={open}
                            onClick={() => setOpenId(open ? null : a.id)}
                            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 text-sm font-semibold text-brand-black hover:bg-stone-50"
                          >
                            {open ? "Hide Details" : "View Details"}
                            {open ? (
                              <ChevronDown className="size-4 rotate-180" />
                            ) : (
                              <ArrowRight className="size-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-stone-50/70">
                          <td colSpan={6} className="px-5 py-4">
                            <div className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
                              {a.items.map((i) => (
                                <div
                                  key={i.itemType}
                                  className="flex items-center gap-3 px-4 py-2.5"
                                >
                                  <span className="w-56 text-sm text-brand-black">
                                    {BOQ_META[i.itemType]?.label ?? i.itemType}
                                  </span>
                                  <span className="font-semibold text-brand-black">
                                    Rs {pkr.format(i.unitRate)}
                                  </span>
                                  <span className="text-xs text-stone-400">
                                    per {unitLabel(i.unit)}
                                  </span>
                                  <span className="ml-auto">
                                    <SourceCell
                                      sources={a.sources}
                                      itemType={i.itemType}
                                    />
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-4 flex items-center gap-2 rounded-xl border border-stone-100 bg-stone-50 px-4 py-3 text-xs text-stone-500">
            <Info className="size-4 shrink-0 text-blue-600" />
            Rates are subject to change. Please contact us for the latest
            updates and site-specific details.
          </p>
        </div>
      </div>

      <CsrImportForm />

      {/* Drafts */}
      <section>
        <h2 className="mb-3 flex items-center gap-3 text-lg font-bold text-brand-black">
          Drafts awaiting review
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
            {drafts.length}
          </span>
        </h2>

        {drafts.length === 0 && (
          <p className="rounded-2xl border border-dashed border-stone-300 bg-white/70 px-4 py-8 text-center text-sm text-stone-400">
            No drafts awaiting review.
          </p>
        )}

        <div className="space-y-5">
          {drafts.map((d) => (
            <section
              key={d.id}
              className="space-y-4 rounded-3xl border border-stone-200/70 bg-white p-5 shadow-[0_10px_40px_-12px_rgba(35,31,30,0.12)] sm:p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <MapPin className="size-4 text-brand" />
                  <h3 className="font-semibold text-brand-black">{d.city}</h3>
                  <CategoryBadge category={d.category} />
                </div>
                <span className="text-xs text-stone-400">
                  {d.origin} · {d.createdLabel ?? ""}
                </span>
              </div>

              {d?.sources?.warnings?.map((w) => (
                <p
                  key={w}
                  className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700"
                >
                  {w}
                </p>
              ))}

              <div className="divide-y divide-stone-100 rounded-xl border border-stone-200">
                {d.items.map((i) => (
                  <div
                    key={i.itemType}
                    className="flex flex-wrap items-center gap-3 px-4 py-2.5"
                  >
                    <span className="w-56 text-sm">
                      {BOQ_META[i.itemType]?.label ?? i.itemType}
                    </span>
                    <Input
                      type="number"
                      aria-label={`${BOQ_META[i.itemType]?.label ?? i.itemType} rate`}
                      className="h-9 w-32 rounded-lg"
                      value={edits[d.id]?.[i.itemType] ?? String(i.unitRate)}
                      onChange={(e) =>
                        setEdits((p) => ({
                          ...p,
                          [d.id]: { ...p[d.id], [i.itemType]: e.target.value },
                        }))
                      }
                    />
                    <span className="text-xs text-stone-500">
                      PKR / {unitLabel(i.unit)}
                    </span>
                    <span className="ml-auto">
                      <SourceCell sources={d.sources} itemType={i.itemType} />
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => approve(d)}
                  disabled={busy !== null}
                  className="h-10 cursor-pointer gap-2 rounded-xl bg-brand px-5 text-white hover:bg-brand-dark"
                >
                  {busy === d.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CircleCheck className="size-4" />
                  )}
                  {busy === d.id ? "Working…" : "Approve"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => reject(d)}
                  disabled={busy !== null}
                  className="h-10 cursor-pointer rounded-xl px-5"
                >
                  Reject
                </Button>
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
