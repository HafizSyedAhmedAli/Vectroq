"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { slugify } from "@/lib/org-slug";
import { AuthSubmit } from "@/components/auth/AuthSubmit";
import { darkAlert, darkInput, darkLabel } from "@/components/auth/dark-styles";

export function SignupForm() {
  const router = useRouter();
  const [f, setF] = useState({
    name: "",
    email: "",
    password: "",
    company: "",
    slug: "",
  });
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      return setError(data.error ?? "Could not create your account.");
    }
    router.push("/office/settings");
    router.refresh();
  }

  const field = (
    id: string,
    label: string,
    key: keyof typeof f,
    type = "text",
    auto?: string,
  ) => (
    <div>
      <Label htmlFor={id} className={darkLabel}>
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        autoComplete={auto}
        className={`mt-1.5 h-11 ${darkInput}`}
        value={f[key]}
        onChange={(e) => set(key, e.target.value)}
      />
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-5">
      {field("su-name", "Your name", "name", "text", "name")}
      {field("su-email", "Email", "email", "email", "email")}
      {field(
        "su-pw",
        "Password (min 8 characters)",
        "password",
        "password",
        "new-password",
      )}
      <div>
        <Label htmlFor="su-company" className={darkLabel}>
          Company name
        </Label>
        <Input
          id="su-company"
          className={`mt-1.5 h-11 ${darkInput}`}
          value={f.company}
          maxLength={100}
          onChange={(e) => {
            set("company", e.target.value);
            if (!slugTouched) set("slug", slugify(e.target.value));
          }}
        />
      </div>
      <div>
        <Label htmlFor="su-slug" className={darkLabel}>
          Your public form address
        </Label>
        <div className="mt-1.5 flex items-center gap-2 text-sm text-stone-500 dark:text-slate-400">
          <span>/c/</span>
          <Input
            id="su-slug"
            className={`h-11 ${darkInput}`}
            value={f.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set("slug", slugify(e.target.value));
            }}
          />
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className={`rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 ${darkAlert}`}
        >
          {error}
        </p>
      )}
      <AuthSubmit busy={busy} busyLabel="Creating…" arrow={false}>
        Create my company
      </AuthSubmit>
    </form>
  );
}
