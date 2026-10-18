"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  Calculator,
  Check,
  ChevronDown,
  CircleCheck,
  Copy,
  Crown,
  Eye,
  Link2,
  Loader2,
  Mail,
  MoreVertical,
  Plus,
  Send,
  Trash2,
  TriangleAlert,
  User,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
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

const ROLE_ICON: Record<Role, LucideIcon> = {
  OWNER: Crown,
  ESTIMATOR: Calculator,
  VIEWER: Eye,
};

const ROLE_HINT: Record<Role, string> = {
  OWNER: "Full access, team and settings",
  ESTIMATOR: "Projects, drawings and rates",
  VIEWER: "Read-only access",
};

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
];

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

const card =
  "rounded-2xl border border-stone-200/70 bg-white shadow-[0_10px_40px_-12px_rgba(15,23,42,0.10)]";

function SectionHeader({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-blue-50 text-brand">
          {icon}
        </span>
        <div>
          <h2 className="text-lg font-bold text-brand-black">{title}</h2>
          <p className="text-sm text-stone-500">{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const Icon = ROLE_ICON[role];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-semibold text-brand">
      <Icon className="size-4" />
      {ROLE_LABEL[role]}
    </span>
  );
}

function BuildTeamBanner() {
  const tiles = [
    { tile: "-rotate-6", chip: "bg-blue-100 text-brand" },
    { tile: "-translate-y-3", chip: "bg-emerald-100 text-emerald-700" },
    { tile: "rotate-3", chip: "bg-violet-100 text-violet-700" },
  ];
  return (
    <section
      className={`${card} relative overflow-hidden bg-gradient-to-r from-blue-50 via-blue-50/60 to-indigo-100/60 p-6 sm:p-7`}
    >
      <div className="flex items-center gap-5">
        <span className="grid size-16 shrink-0 place-items-center rounded-full bg-white/80 text-brand shadow-sm">
          <Users className="size-8" />
        </span>
        <div className="max-w-md">
          <h2 className="text-xl font-bold text-brand-black">
            Build your team
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-stone-600">
            Collaborate with your team members, assign roles and manage
            permissions all in one place.
          </p>
        </div>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute right-8 top-1/2 hidden -translate-y-1/2 items-center gap-3 md:flex"
      >
        {tiles.map((t, i) => (
          <span
            key={i}
            className={`grid size-14 place-items-center rounded-2xl bg-white shadow-lg shadow-blue-900/10 ${t.tile}`}
          >
            <span
              className={`grid size-9 place-items-center rounded-full ${t.chip}`}
            >
              <User className="size-4" />
            </span>
          </span>
        ))}
        <span className="grid size-9 place-items-center rounded-full bg-brand text-white shadow-md">
          <Plus className="size-4" />
        </span>
        <p className="ml-3 max-w-[8rem] text-xs italic text-stone-500">
          Add team members to get started
        </p>
      </div>
    </section>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md animate-fade-up rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
            <TriangleAlert className="size-5" />
          </span>
          <div>
            <h3
              id="confirm-title"
              className="text-lg font-bold text-brand-black"
            >
              {title}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-stone-600">
              {message}
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="h-10 cursor-pointer rounded-xl border border-stone-300 px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-wait disabled:opacity-70"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy ? "Removing…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TeamPanel({
  members,
  invites,
}: {
  members: MemberRow[];
  invites: InviteRow[];
}) {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const inviteRef = useRef<HTMLElement>(null);

  // create-invite form
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("VIEWER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<{
    url: string;
    role: Role;
    emailed: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // member dropdowns
  const [menu, setMenu] = useState<{
    id: string;
    kind: "role" | "more";
  } | null>(null);

  // pending invitations + revoke feedback
  const [localInvites, setLocalInvites] = useState(invites);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);

  const [removing, setRemoving] = useState<MemberRow | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  async function confirmRemove() {
    if (!removing) return;
    setRemoveBusy(true);
    await run(() => call(`/api/team/members/${removing.id}`, "DELETE"));
    setRemoveBusy(false);
    setRemoving(null);
  }

  // keep in sync when the server sends a fresh list (after router.refresh)
  useEffect(() => {
    setLocalInvites(invites);
  }, [invites]);

  // close any open dropdown when clicking elsewhere
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-menu]")) setMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

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
      setLink({ url: data.link, role, emailed: !!data.emailed });
      setEmail("");
    });
    setBusy(false);
  }

  async function revoke(id: string, address: string) {
    setRevokingId(id);
    setInviteError(null);
    setInviteNotice(null);
    try {
      await call(`/api/team/invites/${id}`, "DELETE");
      setLocalInvites((prev) => prev.filter((x) => x.id !== id));
      setConfirmId(null);
      setInviteNotice(`Invitation for ${address} was revoked.`);
      setTimeout(() => setInviteNotice(null), 4000);
      router.refresh();
    } catch (e) {
      setInviteError(
        e instanceof Error ? e.message : "Could not revoke the invitation.",
      );
    } finally {
      setRevokingId(null);
    }
  }

  function focusInvite() {
    inviteRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => emailRef.current?.focus(), 350);
  }

  const menuItem =
    "flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-stone-50";

  return (
    <div className="space-y-6">
      {error && (
        <p
          role="alert"
          className="sticky top-20 z-30 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm"
        >
          {error}
        </p>
      )}

      <BuildTeamBanner />

      {/* Team members */}
      <section className={`${card} p-5 sm:p-6`}>
        <SectionHeader
          icon={<User className="size-5" />}
          title="Team Members"
          subtitle="Manage who can access your account and what they can do."
          action={
            <button
              type="button"
              onClick={focusInvite}
              className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-md shadow-brand/25 hover:bg-brand-dark"
            >
              <Plus className="size-4" />
              Invite Member
            </button>
          }
        />

        <ul className="mt-6 divide-y divide-stone-100 rounded-xl border border-stone-200">
          {members.map((m, i) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center gap-4 px-4 py-4"
            >
              <span
                className={`grid size-11 shrink-0 place-items-center rounded-full text-base font-bold ${
                  AVATAR_COLORS[i % AVATAR_COLORS.length]
                }`}
              >
                {m.name.trim().charAt(0).toUpperCase() || "?"}
              </span>
              <div className="min-w-0 flex-1 basis-40">
                <p className="truncate text-sm font-semibold text-brand-black">
                  {m.name}
                  {m.isYou && " (you)"}
                </p>
                <p className="truncate text-xs text-stone-500">{m.email}</p>
              </div>

              <RoleBadge role={m.role} />

              <div className="ml-auto flex items-center gap-1">
                {/* role dropdown */}
                <div className="relative" data-menu>
                  <button
                    type="button"
                    aria-label={`Change role for ${m.name}`}
                    aria-expanded={menu?.id === m.id && menu.kind === "role"}
                    onClick={() =>
                      setMenu(
                        menu?.id === m.id && menu.kind === "role"
                          ? null
                          : { id: m.id, kind: "role" },
                      )
                    }
                    className="grid size-9 cursor-pointer place-items-center rounded-lg text-stone-500 hover:bg-stone-100"
                  >
                    <ChevronDown className="size-5" />
                  </button>
                  {menu?.id === m.id && menu.kind === "role" && (
                    <div className="absolute right-0 top-10 z-20 w-64 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-xl">
                      {ROLES.map((r) => {
                        const Icon = ROLE_ICON[r];
                        return (
                          <button
                            key={r}
                            type="button"
                            className={menuItem}
                            onClick={() => {
                              setMenu(null);
                              if (r !== m.role)
                                void run(() =>
                                  call(`/api/team/members/${m.id}`, "PATCH", {
                                    role: r,
                                  }),
                                );
                            }}
                          >
                            <Icon className="size-4 text-brand" />
                            <span className="flex-1">
                              <span className="block font-semibold text-brand-black">
                                {ROLE_LABEL[r]}
                              </span>
                              <span className="block text-xs text-stone-500">
                                {ROLE_HINT[r]}
                              </span>
                            </span>
                            {r === m.role && (
                              <Check className="size-4 text-brand" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* more menu */}
                <div className="relative" data-menu>
                  <button
                    type="button"
                    aria-label={`More actions for ${m.name}`}
                    aria-expanded={menu?.id === m.id && menu.kind === "more"}
                    onClick={() =>
                      setMenu(
                        menu?.id === m.id && menu.kind === "more"
                          ? null
                          : { id: m.id, kind: "more" },
                      )
                    }
                    className="grid size-9 cursor-pointer place-items-center rounded-lg text-stone-500 hover:bg-stone-100"
                  >
                    <MoreVertical className="size-5" />
                  </button>
                  {menu?.id === m.id && menu.kind === "more" && (
                    <div className="absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-xl">
                      <button
                        type="button"
                        aria-label={`Remove ${m.name}`}
                        className={`${menuItem} text-red-600`}
                        onClick={() => {
                          setMenu(null);
                          setRemoving(m);
                        }}
                      >
                        <Trash2 className="size-4" />
                        Remove member
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Invite someone */}
      <section ref={inviteRef} className={`${card} p-5 sm:p-6`}>
        <SectionHeader
          icon={<Link2 className="size-5" />}
          title="Invite someone"
          subtitle="Share a link or enter an email address to invite a new member to your team."
        />

        <form
          onSubmit={invite}
          className="mt-6 grid gap-3 md:grid-cols-[1fr_220px_auto]"
        >
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            <input
              ref={emailRef}
              type="email"
              aria-label="Invite email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 w-full rounded-xl border border-stone-200 bg-white pl-11 pr-4 text-[15px] text-brand-black shadow-sm outline-none placeholder:text-stone-400 hover:border-stone-300 focus:border-brand focus:ring-4 focus:ring-brand/15"
            />
          </div>

          <div className="relative">
            <UserPlus className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-stone-500" />
            <select
              aria-label="Invite role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="h-12 w-full cursor-pointer appearance-none rounded-xl border border-stone-200 bg-white pl-11 pr-10 text-[15px] text-brand-black shadow-sm outline-none hover:border-stone-300 focus:border-brand focus:ring-4 focus:ring-brand/15"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-500" />
          </div>

          <button
            type="submit"
            disabled={busy || !email}
            className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand px-6 text-[15px] font-semibold text-white shadow-md shadow-brand/25 hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Create invite link
          </button>
        </form>

        {link && (
          <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-brand">
                <Link2 className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-brand-black">
                  Invitation link
                </p>
                <p className="text-xs text-stone-500">
                  {link.emailed
                    ? "We also emailed it. "
                    : "Email isn't set up, so send this link yourself. "}
                  Anyone with this link can join as {ROLE_LABEL[link.role]}{" "}
                  (valid for 7 days). Shown once.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    readOnly
                    aria-label="Invitation link"
                    value={link.url}
                    onFocus={(e) => e.currentTarget.select()}
                    className="h-11 min-w-0 flex-1 rounded-lg border border-stone-200 bg-white px-3 font-mono text-xs text-stone-700 outline-none"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(link.url);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 text-sm font-semibold text-brand-black hover:bg-stone-50"
                  >
                    {copied ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                    {copied ? "Copied" : "Copy link"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {inviteError && (
          <p
            role="alert"
            className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {inviteError}
          </p>
        )}
        {inviteNotice && (
          <p
            role="status"
            className="mt-5 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
          >
            <CircleCheck className="size-4 shrink-0" />
            {inviteNotice}
          </p>
        )}

        {localInvites.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
              Pending invitations ({localInvites.length})
            </p>
            <ul className="mt-2 divide-y divide-stone-100 text-sm">
              {localInvites.map((i) => {
                const confirming = confirmId === i.id;
                const revoking = revokingId === i.id;
                return (
                  <li
                    key={i.id}
                    className={`flex flex-wrap items-center gap-3 py-3 transition ${
                      revoking ? "opacity-60" : ""
                    }`}
                  >
                    <Mail className="size-4 shrink-0 text-stone-400" />
                    <span className="min-w-0 flex-1 basis-48 truncate font-medium text-brand-black">
                      {i.email}
                    </span>
                    <span className="text-xs text-stone-500">
                      {ROLE_LABEL[i.role]} · Expires {i.expiresLabel}
                    </span>

                    {confirming ? (
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-stone-600">Revoke?</span>
                        <button
                          type="button"
                          disabled={revoking}
                          onClick={() => revoke(i.id, i.email)}
                          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-wait disabled:opacity-70"
                        >
                          {revoking && (
                            <Loader2 className="size-3.5 animate-spin" />
                          )}
                          {revoking ? "Revoking…" : "Yes, revoke"}
                        </button>
                        <button
                          type="button"
                          disabled={revoking}
                          onClick={() => setConfirmId(null)}
                          className="h-8 cursor-pointer rounded-lg border border-stone-300 px-3 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setInviteError(null);
                          setConfirmId(i.id);
                        }}
                        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-stone-300 px-3 text-xs font-semibold text-stone-700 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="size-3.5" />
                        Revoke
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
      {removing && (
        <ConfirmDialog
          title="Remove team member?"
          message={
            <>
              <b>{removing.name}</b> ({removing.email}) will lose access
              immediately and be signed out on their next click.
            </>
          }
          confirmLabel="Remove member"
          busy={removeBusy}
          onConfirm={confirmRemove}
          onCancel={() => setRemoving(null)}
        />
      )}
    </div>
  );
}
