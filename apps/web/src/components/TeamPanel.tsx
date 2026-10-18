"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/auth/roles";

export interface MemberRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  isYou: boolean;
}
export interface InviteRow {
  id: string;
  email: string;
  role: Role;
  expiresLabel: string;
}

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed.");
  return data;
}

export function TeamPanel({
  members,
  invites,
}: {
  members: MemberRow[];
  invites: InviteRow[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [emailed, setEmailed] = useState(false);
  const [role, setRole] = useState<Role>("ESTIMATOR");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  async function invite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setLink(null);
    await run(async () => {
      const data = await call("/api/team/invites", "POST", { email, role });
      setLink(data.link);
      setEmailed(!!data.emailed);
      setEmail("");
    });
    setBusy(false);
  }

  const roleSelect = (
    value: Role,
    onChange: (r: Role) => void,
    label: string,
  ) => (
    <NativeSelect
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value as Role)}
    >
      {ROLES.map((r) => (
        <NativeSelectOption key={r} value={r}>
          {ROLE_LABEL[r]}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );

  return (
    <div className="space-y-8">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="font-bold text-brand-black">Members</h2>
        <ul className="mt-4 divide-y divide-stone-100">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-brand-black">
                  {m.name}
                  {m.isYou && " (you)"}
                </p>
                <p className="truncate text-xs text-stone-500">{m.email}</p>
              </div>
              {roleSelect(
                m.role,
                (r) =>
                  run(() =>
                    call(`/api/team/members/${m.id}`, "PATCH", { role: r }),
                  ),
                `${m.name} role`,
              )}
              <button
                type="button"
                aria-label={`Remove ${m.name}`}
                onClick={() =>
                  confirm(`Remove ${m.name}?`) &&
                  run(() => call(`/api/team/members/${m.id}`, "DELETE"))
                }
                className="grid size-9 cursor-pointer place-items-center rounded-lg text-brand hover:bg-stone-100"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="font-bold text-brand-black">Invite someone</h2>
        <form
          onSubmit={invite}
          className="mt-4 flex flex-wrap items-center gap-3"
        >
          <Input
            type="email"
            aria-label="Invite email"
            placeholder="name@company.com"
            className="h-10 min-w-56 flex-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {roleSelect(role, setRole, "Invite role")}
          <Button
            type="submit"
            disabled={busy || !email}
            className="h-10 gap-2 bg-brand text-white hover:bg-brand-dark"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Create invite link
          </Button>
        </form>

        {link && (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
            <p className="font-medium">
              {emailed
                ? "Invitation emailed. You can also share this link (shown once, valid 7 days):"
                : "Email isn't set up, so send this link yourself (shown once, valid 7 days):"}
            </p>
            <p className="mt-2 break-all font-mono text-xs">{link}</p>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-green-300 bg-white px-3 py-1.5 font-semibold"
            >
              {copied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        )}

        {invites.length > 0 && (
          <ul className="mt-6 divide-y divide-stone-100 text-sm">
            {invites.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-2.5">
                <span className="flex-1 truncate">{i.email}</span>
                <span className="text-xs text-stone-500">
                  {ROLE_LABEL[i.role]} · expires {i.expiresLabel}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    run(() => call(`/api/team/invites/${i.id}`, "DELETE"))
                  }
                  className="text-xs text-stone-500 underline"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
