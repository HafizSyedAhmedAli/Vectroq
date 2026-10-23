"use client";

import { useState } from "react";
import { Check, CircleCheck, Loader2 } from "lucide-react";

type PlanId = "FREE" | "PRO" | "BUSINESS";

interface Props {
  currentPlan: PlanId;
  hasSubscription: boolean;
  billingEnabled: boolean;
  isDemo: boolean;
  flash: "success" | "cancelled" | null;
  usage: {
    projects: number;
    projectLimit: number | null;
    seats: number;
    seatLimit: number | null;
  };
  plans: { id: PlanId; name: string; price: string; features: string[] }[];
}

const card =
  "rounded-2xl border border-stone-200/70 bg-white p-5 shadow-[0_10px_40px_-12px_rgba(15,23,42,0.10)] sm:p-6";

function Meter({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | null;
}) {
  const pct = limit === null ? 0 : Math.min(100, (used / limit) * 100);
  const full = limit !== null && used >= limit;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="font-medium text-brand-black">{label}</span>
        <span className={full ? "font-semibold text-red-600" : "text-stone-500"}>
          {used} / {limit ?? "unlimited"}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
        <span
          className={`block h-full ${full ? "bg-red-500" : "bg-brand"}`}
          style={{ width: `${limit === null ? 4 : pct}%` }}
        />
      </div>
    </div>
  );
}

export function BillingPanel(p: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(url: string, body: unknown, key: string) {
    setBusy(key);
    setError(null);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
      setBusy(null);
      return setError(data.error ?? "Something went wrong.");
    }
    window.location.href = data.url;
  }

  return (
    <div className="space-y-6">
      {p.flash === "success" && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          <CircleCheck className="size-4" /> Payment received. Your plan updates
          within a few seconds. Refresh if it still shows the old one.
        </p>
      )}
      {p.flash === "cancelled" && (
        <p className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
          Checkout was cancelled. You have not been charged.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <section className={card}>
        <h2 className="text-lg font-bold text-brand-black">Usage this month</h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <Meter label="Projects" used={p.usage.projects} limit={p.usage.projectLimit} />
          <Meter label="Team seats" used={p.usage.seats} limit={p.usage.seatLimit} />
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-3">
        {p.plans.map((pl) => {
          const current = pl.id === p.currentPlan;
          return (
            <section
              key={pl.id}
              className={`${card} ${current ? "ring-2 ring-brand" : ""}`}
            >
              <h3 className="font-bold text-brand-black">{pl.name}</h3>
              <p className="mt-2 text-2xl font-extrabold text-brand-black">
                {pl.price}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-stone-600">
                {pl.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                    {f}
                  </li>
                ))}
              </ul>

              <div className="mt-5">
                {current ? (
                  <span className="inline-block rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
                    Current plan
                  </span>
                ) : pl.id === "FREE" ? (
                  p.hasSubscription && (
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => go("/api/billing/portal", {}, "portal")}
                      className="cursor-pointer text-sm font-semibold text-stone-600 underline"
                    >
                      Downgrade in billing portal
                    </button>
                  )
                ) : p.currentPlan === "FREE" ? (
                  <button
                    type="button"
                    disabled={!!busy || !p.billingEnabled || p.isDemo}
                    onClick={() =>
                      go("/api/billing/checkout", { plan: pl.id }, pl.id)
                    }
                    className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy === pl.id && <Loader2 className="size-4 animate-spin" />}
                    Upgrade to {pl.name}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => go("/api/billing/portal", {}, "portal")}
                    className="h-11 w-full cursor-pointer rounded-xl border border-brand/40 text-sm font-semibold text-brand hover:bg-brand/5"
                  >
                    Change in billing portal
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {p.hasSubscription && (
        <button
          type="button"
          disabled={!!busy}
          onClick={() => go("/api/billing/portal", {}, "portal")}
          className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-stone-300 bg-white px-5 text-sm font-semibold text-brand-black hover:bg-stone-50"
        >
          {busy === "portal" && <Loader2 className="size-4 animate-spin" />}
          Manage billing (invoices, card, cancel)
        </button>
      )}
      {!p.billingEnabled && (
        <p className="text-xs text-stone-400">
          Stripe is not configured on this server, so upgrades are disabled.
        </p>
      )}
      {p.isDemo && (
        <p className="text-xs text-stone-400">
          Upgrades are disabled in the demo company.
        </p>
      )}
    </div>
  );
}