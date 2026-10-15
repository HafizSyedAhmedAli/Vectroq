// apps/web/src/components/CsrImportForm.tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  CircleCheck,
  Download,
  FileText,
  Loader2,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CSR_CSV_MAX_BYTES } from "@/lib/rate-set-types";

const CATEGORIES = ["A", "B", "C"] as const;
type Cat = (typeof CATEGORIES)[number];

const TEMPLATE = [
  "city,itemType,unit,unitRate",
  "Karachi,brick,1000nos,",
  "Karachi,cement,bag,",
  "Karachi,sand,cft,",
  "Karachi,steelMaterial,ton,",
  "",
].join("\n");

const inputCls =
  "h-11 rounded-xl border-stone-200! bg-white! text-[15px] text-brand-black shadow-sm focus-visible:border-brand! focus-visible:ring-brand/20";

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () =>
      reject(reader.error ?? new Error("Could not read the file."));
    reader.readAsText(file);
  });
}

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([TEMPLATE], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "rates-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// Loads a Composite Schedule of Rates. The whole file is validated first;
// if anything is wrong nothing is saved and the problem is shown here.
export function CsrImportForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [documentName, setDocumentName] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [approvedBy, setApprovedBy] = useState("");
  const [categories, setCategories] = useState<Cat[]>([...CATEGORIES]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    imported: number;
    cities: string[];
  } | null>(null);

  function pickFile(f: File | null) {
    setResult(null);
    setError(null);
    if (!f) return setFile(null);
    if (!f.name.toLowerCase().endsWith(".csv")) {
      setFile(null);
      return setError("Choose a .csv file.");
    }
    if (f.size > CSR_CSV_MAX_BYTES) {
      setFile(null);
      return setError("That file is larger than 1 MB.");
    }
    setFile(f);
  }

  function toggle(c: Cat) {
    setCategories((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setResult(null);

    const yearNum = Number(year);
    if (!file) return setError("Choose a CSV file.");
    if (!documentName.trim()) return setError("Enter the schedule name.");
    if (!Number.isInteger(yearNum) || yearNum < 2000 || yearNum > 2100) {
      return setError("Enter a valid year, for example 2026.");
    }
    if (categories.length === 0)
      return setError("Choose at least one category.");
    if (!approvedBy.trim())
      return setError("Enter your name under Approved by.");

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/rate-sets/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csv: await readText(file),
          document: documentName.trim(),
          year: yearNum,
          categories,
          approvedBy: approvedBy.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Import failed.");
      setResult({ imported: data.imported, cities: data.cities });
      setFile(null);
      router.refresh(); // reload the approved list above
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-stone-200/70 bg-white p-5 shadow-[0_10px_40px_-12px_rgba(35,31,30,0.12)] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand text-white shadow-md shadow-brand/30">
            <FileText className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-brand-black">
              Import a rate schedule (CSR)
            </h2>
            <p className="text-sm text-stone-500">
              Rates go live immediately and replace the previous CSR for the
              same cities and categories.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={downloadTemplate}
          className="h-10 cursor-pointer gap-2 rounded-xl bg-white px-4 text-sm font-semibold"
        >
          <Download className="size-4" />
          Download CSV template
        </Button>
      </div>

      <form onSubmit={submit} noValidate className="mt-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="csr-doc" className="text-[13px] font-semibold">
              Schedule name
            </Label>
            <Input
              id="csr-doc"
              className={`mt-1.5 ${inputCls}`}
              placeholder="e.g. Sindh CSR"
              maxLength={100}
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="csr-year" className="text-[13px] font-semibold">
              Year
            </Label>
            <Input
              id="csr-year"
              type="number"
              className={`mt-1.5 ${inputCls}`}
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="csr-by" className="text-[13px] font-semibold">
              Approved by
            </Label>
            <Input
              id="csr-by"
              className={`mt-1.5 ${inputCls}`}
              placeholder="Your name"
              maxLength={100}
              value={approvedBy}
              onChange={(e) => setApprovedBy(e.target.value)}
            />
          </div>
        </div>

        <fieldset>
          <legend className="text-[13px] font-semibold">
            Apply to categories
          </legend>
          <div className="mt-2 flex flex-wrap gap-4">
            {CATEGORIES.map((c) => (
              <label
                key={c}
                className="flex cursor-pointer items-center gap-2 text-sm text-stone-700"
              >
                <input
                  type="checkbox"
                  className="size-4 accent-brand"
                  checked={categories.includes(c)}
                  onChange={() => toggle(c)}
                />
                Category {c}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <input
            id="csr-file"
            type="file"
            accept=".csv,text/csv"
            className="peer sr-only"
            onChange={(e) => {
              pickFile(e.target.files?.[0] ?? null);
              e.target.value = ""; // allow re-picking the same file
            }}
          />
          <label
            htmlFor="csr-file"
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-brand-black hover:bg-stone-50 peer-focus-visible:ring-3 peer-focus-visible:ring-brand/40"
          >
            <UploadCloud className="size-4" />
            CSV file
          </label>
          <span className="max-w-xs truncate text-xs text-stone-500">
            {file?.name ?? "No file chosen"}
          </span>
        </div>

        <p className="text-xs text-stone-400">
          Columns: city, itemType, unit, unitRate. Every city needs brick,
          cement, sand and steelMaterial. Labour rates are fixed in code, so
          leave them out.
        </p>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        {result && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
          >
            <CircleCheck className="mt-0.5 size-4 shrink-0" />
            Imported {result.imported} rate set
            {result.imported === 1 ? "" : "s"} for {result.cities.join(", ")}.
          </p>
        )}

        <Button
          type="submit"
          disabled={busy}
          className="h-11 cursor-pointer gap-2 rounded-xl bg-brand px-6 text-[15px] font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <UploadCloud className="size-4" />
          )}
          {busy ? "Importing…" : "Import rates"}
        </Button>
      </form>
    </section>
  );
}
