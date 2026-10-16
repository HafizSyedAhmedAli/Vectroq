"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Loader2, Plus, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface OrgSettingsInitial {
  name: string;
  tagline: string;
  primaryColor: string;
  phone: string;
  email: string;
  website: string;
  logoUrl: string | null;
  offices: { title: string; address: string }[];
}

export function OrgSettingsForm({ initial }: { initial: OrgSettingsInitial }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof OrgSettingsInitial>(
    k: K,
    v: OrgSettingsInitial[K],
  ) => {
    setSaved(false);
    setF((p) => ({ ...p, [k]: v }));
  };

  async function uploadLogo(file: File | undefined) {
    if (!file) return;
    setError(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/org/logo", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error ?? "Upload failed.");
    set("logoUrl", data.logoUrl);
    router.refresh();
  }

  async function removeLogo() {
    await fetch("/api/org", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ removeLogo: true }),
    });
    set("logoUrl", null);
    router.refresh();
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { logoUrl: _logo, ...rest } = f;
    const res = await fetch("/api/org", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rest),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Could not save.");
    setSaved(true);
    router.refresh();
  }

  const text = (
    id: string,
    label: string,
    key: "name" | "tagline" | "phone" | "email" | "website",
  ) => (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className="mt-1.5 h-10"
        value={f[key]}
        onChange={(e) => set(key, e.target.value)}
      />
    </div>
  );

  return (
    <form
      onSubmit={save}
      className="space-y-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-4">
        {f.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={f.logoUrl}
            alt="Logo"
            className="h-14 w-auto rounded border border-stone-200 p-1"
          />
        ) : (
          <span className="text-sm text-stone-400">
            No logo: your company name is shown instead.
          </span>
        )}
        <input
          id="logo-file"
          type="file"
          accept="image/png,image/jpeg"
          className="sr-only"
          onChange={(e) => {
            void uploadLogo(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <label
          htmlFor="logo-file"
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold hover:bg-stone-50"
        >
          <UploadCloud className="size-4" /> Upload logo (PNG/JPG, max 1 MB)
        </label>
        {f.logoUrl && (
          <button
            type="button"
            onClick={removeLogo}
            className="text-sm text-stone-500 underline"
          >
            Remove
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {text("o-name", "Company name", "name")}
        {text("o-tag", "Tagline", "tagline")}
        <div>
          <Label htmlFor="o-color">Brand color</Label>
          <div className="mt-1.5 flex items-center gap-3">
            <input
              id="o-color"
              type="color"
              value={f.primaryColor}
              onChange={(e) => set("primaryColor", e.target.value)}
              className="h-10 w-14 cursor-pointer rounded border border-stone-200"
            />
            <span className="font-mono text-sm text-stone-500">
              {f.primaryColor}
            </span>
          </div>
        </div>
        {text("o-phone", "Phone", "phone")}
        {text("o-email", "Email", "email")}
        {text("o-web", "Website", "website")}
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Offices</legend>
        {f.offices.map((o, i) => (
          <div key={i} className="flex gap-2">
            <Input
              aria-label={`Office ${i + 1} title`}
              placeholder="Title"
              className="h-10 w-40"
              value={o.title}
              onChange={(e) =>
                set(
                  "offices",
                  f.offices.map((x, j) =>
                    j === i ? { ...x, title: e.target.value } : x,
                  ),
                )
              }
            />
            <Input
              aria-label={`Office ${i + 1} address`}
              placeholder="Address"
              className="h-10 flex-1"
              value={o.address}
              onChange={(e) =>
                set(
                  "offices",
                  f.offices.map((x, j) =>
                    j === i ? { ...x, address: e.target.value } : x,
                  ),
                )
              }
            />
            <button
              type="button"
              aria-label={`Remove office ${i + 1}`}
              onClick={() =>
                set(
                  "offices",
                  f.offices.filter((_, j) => j !== i),
                )
              }
              className="grid size-10 place-items-center rounded-lg text-brand hover:bg-stone-100"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        {f.offices.length < 5 && (
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() =>
              set("offices", [...f.offices, { title: "", address: "" }])
            }
          >
            <Plus className="size-4" /> Add office
          </Button>
        )}
      </fieldset>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {saved && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
        >
          <CircleCheck className="size-4" /> Saved.
        </p>
      )}

      <Button
        type="submit"
        disabled={busy}
        className="h-11 gap-2 bg-brand px-6 text-white hover:bg-brand-dark"
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        Save settings
      </Button>
    </form>
  );
}
