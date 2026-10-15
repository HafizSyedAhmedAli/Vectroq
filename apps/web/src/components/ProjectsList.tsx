// apps/web/src/components/ProjectsList.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Box,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Filter,
  House,
  MapPin,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

export interface ProjectCardData {
  id: string;
  name: string;
  city: string;
  model: number;
  category: string;
  status: string;
  hasRender: boolean;
  imageUrl: string;
  createdLabel: string;
  valueLabel: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  NEW: "bg-stone-100 text-stone-600",
  CAD_UPLOADED: "bg-amber-100 text-amber-700",
  FINALIZED: "bg-green-100 text-green-700",
};

const STATUS_OPTIONS = [
  { value: "NEW", label: "New" },
  { value: "CAD_UPLOADED", label: "CAD uploaded" },
  { value: "FINALIZED", label: "Finalized" },
];

const selectCls =
  "w-full cursor-pointer [&_select]:h-11 [&_select]:rounded-xl [&_select]:border-stone-200 [&_select]:bg-white [&_select]:pl-10 [&_select]:text-sm [&_select]:text-stone-500 [&_select:hover]:border-stone-300 [&_select:focus-visible]:border-brand [&_select:focus-visible]:ring-brand/20";

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 first:pl-0 sm:px-6 sm:first:pl-0">
      <span className="grid size-9 shrink-0 place-items-center rounded-full border border-stone-200 bg-white text-brand-black">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-stone-400">{label}</p>
        <p className="truncate text-sm font-semibold text-brand-black">
          {value}
        </p>
      </div>
    </div>
  );
}

export function ProjectsList({ projects }: { projects: ProjectCardData[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter(
      (p) =>
        (!q ||
          p.name.toLowerCase().includes(q) ||
          p.city.toLowerCase().includes(q)) &&
        (!status || p.status === status) &&
        (!category || p.category === category),
    );
  }, [projects, query, status, category]);

  const hasFilters = !!(query || status || category);

  return (
    <div>
      {/* Search + filters */}
      <div className="rounded-2xl border border-stone-200/70 bg-white/95 p-4 shadow-[0_10px_40px_-12px_rgba(35,31,30,0.15)] backdrop-blur">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_220px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-500" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects…"
              aria-label="Search projects"
              className="h-11 w-full rounded-xl border border-stone-200 bg-white pl-10 pr-3 text-sm text-brand-black outline-none placeholder:text-stone-400 hover:border-stone-300 focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20"
            />
          </div>

          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-stone-500" />
            <NativeSelect
              aria-label="Filter by status"
              className={selectCls}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <NativeSelectOption value="">All Statuses</NativeSelectOption>
              {STATUS_OPTIONS.map((s) => (
                <NativeSelectOption key={s.value} value={s.value}>
                  {s.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <div className="relative">
            <Filter className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-stone-500" />
            <NativeSelect
              aria-label="Filter by category"
              className={selectCls}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <NativeSelectOption value="">All Categories</NativeSelectOption>
              <NativeSelectOption value="A">Category A</NativeSelectOption>
              <NativeSelectOption value="B">Category B</NativeSelectOption>
              <NativeSelectOption value="C">Category C</NativeSelectOption>
            </NativeSelect>
          </div>

          <Button
            type="button"
            onClick={() => {
              setQuery("");
              setStatus("");
              setCategory("");
            }}
            disabled={!hasFilters}
            className="h-11 cursor-pointer gap-2 rounded-xl bg-brand px-6 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed"
          >
            <SlidersHorizontal className="size-4" />
            {hasFilters ? "Reset" : "Filters"}
          </Button>
        </div>
      </div>

      {/* Cards */}
      <div className="mt-6 space-y-5">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-stone-200/70 bg-white/95 p-10 text-center shadow-sm">
            <p className="text-lg font-semibold text-brand-black">
              {projects.length === 0
                ? "No projects yet"
                : "No projects match your filters"}
            </p>
            <p className="mt-1 text-sm text-stone-500">
              {projects.length === 0
                ? "A project is created once office follows up on a lead (SRS §3 step 4)."
                : "Try a different search or clear the filters."}
            </p>
          </div>
        ) : (
          filtered.map((p) => (
            <Link
              key={p.id}
              href={`/office/${p.id}`}
              className="group flex flex-col gap-5 rounded-2xl border border-stone-200/70 bg-white/95 p-5 shadow-[0_10px_40px_-12px_rgba(35,31,30,0.12)] backdrop-blur transition hover:border-brand/40 hover:shadow-[0_14px_44px_-12px_rgba(35,31,30,0.22)] sm:flex-row"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- renders are served from public/ and overwritten in place */}
              <img
                src={p.imageUrl}
                alt=""
                className="h-40 w-full shrink-0 rounded-xl object-cover sm:h-36 sm:w-52"
              />

              <div className="flex min-w-0 flex-1 flex-col justify-between gap-4">
                <div className="flex items-start gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-stone-200 bg-white text-brand shadow-sm">
                    <House className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xl font-bold text-brand-black">
                      {p.name}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-stone-500">
                      <MapPin className="size-3.5" />
                      {p.city} · Model {p.model} · Category {p.category}
                      {p.hasRender && <> · render ready</>}
                    </p>
                  </div>
                  <span
                    className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                      STATUS_STYLES[p.status] ?? "bg-stone-100 text-stone-600"
                    }`}
                  >
                    {p.status.replace("_", " ")}
                  </span>
                  <span className="grid size-10 shrink-0 place-items-center rounded-full border border-stone-200 bg-white text-brand-black shadow-sm transition group-hover:border-brand group-hover:text-brand">
                    <ChevronRight className="size-4" />
                  </span>
                </div>

                <div className="grid grid-cols-1 divide-stone-200 border-t border-stone-100 pt-4 sm:grid-cols-3 sm:divide-x">
                  {p.valueLabel ? (
                    <Stat
                      icon={<CircleDollarSign className="size-4" />}
                      label="Project Value"
                      value={p.valueLabel}
                    />
                  ) : (
                    <Stat
                      icon={<CalendarDays className="size-4" />}
                      label="Created"
                      value={p.createdLabel}
                    />
                  )}
                  <Stat
                    icon={<Box className="size-4" />}
                    label="Category"
                    value={p.category}
                  />
                  <Stat
                    icon={<Box className="size-4" />}
                    label="Model"
                    value={`Model ${p.model}`}
                  />
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
