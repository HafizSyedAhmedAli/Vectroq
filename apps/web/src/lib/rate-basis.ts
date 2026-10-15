// apps/web/src/lib/rate-basis.ts
import type { RateBasisInfo } from "@tmcc/shared-types";

interface BasisInput {
  place: string;
  isFallback: boolean;
  origin: string;
  sources: unknown;
}

function scheduleLabel(origin: string, sources: unknown): string {
  const s = sources as { document?: unknown; year?: unknown } | null;
  const doc = typeof s?.document === "string" ? s.document.trim() : "";
  if (origin === "csr") {
    if (!doc) return "Composite Schedule of Rates";
    return typeof s?.year === "number" ? `${doc} ${s.year}` : doc;
  }
  return "Office-approved rates";
}

export function toRateBasisInfo(
  basis: BasisInput,
  requestedCity: string,
): RateBasisInfo {
  return {
    label: scheduleLabel(basis.origin, basis.sources),
    place: basis.place,
    requestedCity,
    isFallback: basis.isFallback,
    origin: basis.origin,
  };
}

/** One plain-ASCII line, safe for the PDF's built-in Helvetica font. */
export function rateBasisLine(info: RateBasisInfo): string {
  return info.isFallback
    ? `Rates: ${info.label}, using ${info.place} rates (no rates loaded for ${info.requestedCity})`
    : `Rates: ${info.label} (${info.place})`;
}
