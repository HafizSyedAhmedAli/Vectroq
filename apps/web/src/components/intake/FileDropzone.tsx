// apps/web/src/components/intake/FileDropzone.tsx
"use client";

import { useState, type DragEvent } from "react";
import { FileCheck2, UploadCloud, X } from "lucide-react";
import { PLAN_FILE_EXTENSIONS, PLAN_FILE_MAX_BYTES } from "@tmcc/lead-intake";
import { FieldError } from "./fields";

interface FileDropzoneProps {
  id: string;
  label: string;
  file: File | null;
  error?: string | null;
  onChange: (file: File | null) => void;
}

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export function FileDropzone({
  id,
  label,
  file,
  error,
  onChange,
}: FileDropzoneProps) {
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    onChange(e.dataTransfer.files?.[0] ?? null);
  }

  return (
    <div>
      {file ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-6">
          <span className="flex min-w-0 items-center gap-2 text-sm text-brand-black">
            <FileCheck2 className="size-5 shrink-0 text-green-600" />
            <span className="truncate">{file.name}</span>
            <span className="shrink-0 text-xs text-stone-400">
              {formatSize(file.size)}
            </span>
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Remove uploaded file"
            className="cursor-pointer rounded-full p-1 text-stone-500 hover:bg-stone-100"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed px-4 py-6 text-center transition-colors ${
            dragging
              ? "border-brand bg-red-50/40"
              : "border-stone-300 hover:border-stone-400"
          }`}
        >
          <UploadCloud className="size-6 text-brand-black" />
          <span className="text-xs font-semibold text-brand-black">
            {label} (optional)
          </span>
          <span className="text-xs text-stone-500">
            Drag and drop your file here, or click to browse
          </span>
          <span className="text-[11px] text-stone-400">
            {PLAN_FILE_EXTENSIONS.map((e) => e.toUpperCase()).join(", ")} · Max{" "}
            {PLAN_FILE_MAX_BYTES / 1024 / 1024}MB
          </span>
          <input
            id={id}
            type="file"
            className="sr-only"
            accept={PLAN_FILE_EXTENSIONS.map((e) => `.${e}`).join(",")}
            onChange={(e) => {
              onChange(e.target.files?.[0] ?? null);
              e.target.value = ""; // allow re-picking the same file
            }}
          />
        </label>
      )}
      <FieldError message={error ?? undefined} />
    </div>
  );
}
