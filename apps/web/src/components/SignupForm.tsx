"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { slugify } from "@/lib/org-slug";

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/orgs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      return setError(data.error ?? "Could not create your company.");
    }
    router.push("/office/settings");
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-5 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
    >
      <div>
        <Label htmlFor="su-name">Company name</Label>
        <Input
          id="su-name"
          className="mt-1.5 h-11"
          value={name}
          maxLength={100}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
        />
      </div>
      <div>
        <Label htmlFor="su-slug">Your public form address</Label>
        <div className="mt-1.5 flex items-center gap-2 text-sm text-stone-500">
          <span>/c/</span>
          <Input
            id="su-slug"
            className="h-11"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
          />
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <Button
        type="submit"
        disabled={busy || !name.trim() || !slug}
        className="h-11 w-full gap-2 bg-brand text-white hover:bg-brand-dark"
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        Create my company
      </Button>
    </form>
  );
}
