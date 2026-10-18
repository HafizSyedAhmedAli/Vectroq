"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Building,
  Building2,
  Check,
  ChevronsUpDown,
  CircleCheck,
  Globe,
  ImageIcon,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Save,
  Tag,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { CompanyIllustration } from "./CompanyIllustration";

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

const card =
  "rounded-2xl border border-stone-200/70 bg-white shadow-[0_10px_40px_-12px_rgba(15,23,42,0.10)]";

const inputBase =
  "h-12 w-full rounded-xl border border-stone-200 bg-white text-[15px] text-brand-black shadow-sm outline-none placeholder:text-stone-400 hover:border-stone-300 focus:border-brand focus:ring-4 focus:ring-brand/15";
const inputCls = `${inputBase} pl-11 pr-4`;

const officeInput =
  "h-11 rounded-xl border border-stone-200 bg-white px-4 text-sm shadow-sm outline-none placeholder:text-stone-400 hover:border-stone-300 focus:border-brand focus:ring-4 focus:ring-brand/15";

const HEX = /^#[0-9a-fA-F]{6}$/;

const CHECKS = [
  "Trusted by your clients",
  "Professional brand presence",
  "Better client communication",
  "Customizable anytime",
];

function IconInput({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="relative mt-2">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-500 [&_svg]:size-4">
        {icon}
      </span>
      {children}
    </div>
  );
}

export function OrgSettingsForm({ initial }: { initial: OrgSettingsInitial }) {
  const router = useRouter();
  const colorRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const colorOk = HEX.test(f.primaryColor);
  const previewColor = colorOk ? f.primaryColor : "#2563EB";

  const set = <K extends keyof OrgSettingsInitial>(
    k: K,
    v: OrgSettingsInitial[K],
  ) => {
    setSaved(false);
    setF((p) => ({ ...p, [k]: v }));
  };

  function openPicker() {
    const el = colorRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch {
        /* fall through */
      }
    }
    el.click();
  }

  async function uploadLogo(file: File | undefined) {
    if (!file) return;
    setError(null);
    setLogoBusy(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/org/logo", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    setLogoBusy(false);
    if (!res.ok) return setError(data.error ?? "Upload failed.");
    set("logoUrl", data.logoUrl);
    router.refresh();
  }

  async function removeLogo() {
    setError(null);
    const res = await fetch("/api/org", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ removeLogo: true }),
    });
    if (!res.ok) return setError("Could not remove the logo.");
    set("logoUrl", null);
    router.refresh();
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!colorOk) return setError("Brand color must look like #2563EB.");
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
    icon: ReactNode,
    placeholder: string,
    type = "text",
  ) => (
    <div>
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      <IconInput icon={icon}>
        <input
          id={id}
          type={type}
          className={inputCls}
          placeholder={placeholder}
          value={f[key]}
          onChange={(e) => set(key, e.target.value)}
        />
      </IconInput>
    </div>
  );

  return (
    <form
      onSubmit={save}
      className="grid items-stretch gap-6 lg:grid-cols-[1fr_330px]"
    >
      {/* Company details */}
      <section className={`${card} p-5 sm:p-7`}>
        <div className="flex items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-blue-50 text-brand">
            <Building className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-brand-black">
              Company details
            </h2>
            <p className="text-sm text-stone-500">
              Update your company information below.
            </p>
          </div>
        </div>

        {/* Logo (not in the mock, but owners need a way to upload one) */}
        <div className="mt-6 flex flex-wrap items-center gap-4 rounded-xl border border-stone-200 bg-stone-50/60 p-3.5">
          <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-stone-200 bg-white">
            {f.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={f.logoUrl}
                alt="Logo"
                className="size-full object-contain p-1"
              />
            ) : (
              <ImageIcon className="size-5 text-stone-300" />
            )}
          </span>
          <div className="min-w-0 flex-1 basis-44">
            <p className="text-sm font-semibold text-brand-black">
              Company logo
            </p>
            <p className="text-xs text-stone-500">PNG or JPG, max 1 MB.</p>
          </div>
          <input
            id="logo-file"
            type="file"
            accept="image/png,image/jpeg"
            className="peer sr-only"
            onChange={(e) => {
              void uploadLogo(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <label
            htmlFor="logo-file"
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 text-sm font-semibold text-brand-black hover:bg-stone-50 peer-focus-visible:ring-4 peer-focus-visible:ring-brand/20"
          >
            {logoBusy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UploadCloud className="size-4" />
            )}
            {logoBusy ? "Uploading…" : f.logoUrl ? "Replace" : "Upload logo"}
          </label>
          {f.logoUrl && (
            <button
              type="button"
              onClick={removeLogo}
              className="cursor-pointer text-sm font-medium text-stone-500 underline hover:text-red-600"
            >
              Remove
            </button>
          )}
        </div>

        <div className="mt-6 grid gap-x-5 gap-y-5 sm:grid-cols-2">
          {text(
            "o-name",
            "Company name",
            "name",
            <Building2 />,
            "Your company",
          )}
          {text("o-tag", "Tagline", "tagline", <Tag />, "Build Better Spaces")}

          <div>
            <Label htmlFor="o-color-hex" className="text-sm font-semibold">
              Brand color
            </Label>
            <div className="relative mt-2">
              <button
                type="button"
                onClick={openPicker}
                aria-label="Pick a brand color"
                className="absolute left-3 top-1/2 size-7 -translate-y-1/2 cursor-pointer rounded-md border border-black/10"
                style={{ backgroundColor: previewColor }}
              />
              <input
                ref={colorRef}
                type="color"
                tabIndex={-1}
                aria-hidden
                value={previewColor}
                onChange={(e) => set("primaryColor", e.target.value)}
                className="pointer-events-none absolute left-3 top-full h-px w-px opacity-0"
              />
              <input
                id="o-color-hex"
                className={`${inputBase} pl-14 pr-11 font-mono uppercase ${
                  colorOk
                    ? ""
                    : "border-red-400 focus:border-red-500 focus:ring-red-100"
                }`}
                maxLength={7}
                value={f.primaryColor}
                aria-invalid={!colorOk}
                onChange={(e) => {
                  let v = e.target.value.trim();
                  if (v && !v.startsWith("#")) v = `#${v}`;
                  set("primaryColor", v);
                }}
              />
              <button
                type="button"
                onClick={openPicker}
                aria-label="Open color picker"
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-stone-500 hover:text-brand-black"
              >
                <ChevronsUpDown className="size-4" />
              </button>
            </div>
            {!colorOk && (
              <p className="mt-1.5 text-xs font-medium text-red-600">
                Use a 6-digit hex color like #2563EB.
              </p>
            )}
          </div>

          {text("o-phone", "Phone", "phone", <Phone />, "+92 300 1234567")}
          {text(
            "o-email",
            "Email",
            "email",
            <Mail />,
            "contact@company.com",
            "email",
          )}
          {text(
            "o-web",
            "Website",
            "website",
            <Globe />,
            "https://company.com",
          )}
        </div>

        {/* Offices */}
        <fieldset className="mt-7">
          <legend className="flex items-center gap-2 text-sm font-semibold text-brand-black">
            <MapPin className="size-4" /> Offices
          </legend>

          <div className="mt-3 space-y-3">
            {f.offices.map((o, i) => (
              <div key={i} className="flex flex-wrap gap-2 sm:flex-nowrap">
                <input
                  aria-label={`Office ${i + 1} title`}
                  placeholder="Title (e.g. Head office)"
                  className={`${officeInput} w-full sm:w-48`}
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
                <input
                  aria-label={`Office ${i + 1} address`}
                  placeholder="Address"
                  className={`${officeInput} min-w-0 flex-1`}
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
                  className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl text-stone-500 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>

          {f.offices.length < 5 && (
            <button
              type="button"
              onClick={() =>
                set("offices", [...f.offices, { title: "", address: "" }])
              }
              className="mt-3 inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-brand/30 bg-blue-50/60 px-4 text-sm font-semibold text-brand hover:border-brand hover:bg-blue-50"
            >
              <Plus className="size-4" /> Add office
            </button>
          )}
        </fieldset>

        {error && (
          <p
            role="alert"
            className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        {saved && (
          <p
            role="status"
            className="mt-6 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
          >
            <CircleCheck className="size-4" /> Settings saved.
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-white shadow-md shadow-brand/25 hover:bg-brand-dark disabled:cursor-wait disabled:opacity-70"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {busy ? "Saving…" : "Save settings"}
        </button>
      </section>

      {/* Your company */}
      <aside
        className={`${card} flex flex-col bg-gradient-to-b from-blue-50/60 to-white p-4`}
      >
        <CompanyIllustration />
        <div className="px-2 pb-3 pt-6">
          <h3 className="text-lg font-bold text-brand-black">Your company</h3>
          <p className="mt-2 text-sm leading-relaxed text-stone-500">
            This information will appear on your client pages, PDFs and forms.
          </p>
          <ul className="mt-5 space-y-3.5 text-sm text-stone-600">
            {CHECKS.map((c) => (
              <li key={c} className="flex items-center gap-3">
                <Check className="size-4 shrink-0 text-brand" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </form>
  );
}
