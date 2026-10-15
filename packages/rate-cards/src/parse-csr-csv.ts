import type { RateCardItem } from "@tmcc/shared-types";
import { validateRateItems } from "./validate-rate-items";

export type CsrParseResult =
  | { ok: true; byCity: Record<string, RateCardItem[]> }
  | { ok: false; error: string };

// Columns: city,itemType,unit,unitRate  (plain numbers, no thousands commas)
export function parseCsrCsv(text: string): CsrParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return { ok: false, error: "CSV has no data rows" };

  const cols = lines[0].split(",").map((c) => c.trim());
  const at = {
    city: cols.indexOf("city"),
    itemType: cols.indexOf("itemType"),
    unit: cols.indexOf("unit"),
    unitRate: cols.indexOf("unitRate"),
  };
  const missing = Object.entries(at)
    .filter(([, i]) => i < 0)
    .map(([c]) => c);
  if (missing.length) {
    return { ok: false, error: `Missing column(s): ${missing.join(", ")}` };
  }

  const raw: Record<string, unknown[]> = {};
  for (let n = 1; n < lines.length; n++) {
    const cells = lines[n].split(",").map((c) => c.trim());
    const city = cells[at.city];
    if (!city) return { ok: false, error: `Row ${n + 1}: city is empty` };
    (raw[city] ??= []).push({
      itemType: cells[at.itemType],
      unit: cells[at.unit],
      unitRate: Number(cells[at.unitRate]),
    });
  }

  const byCity: Record<string, RateCardItem[]> = {};
  for (const [city, rows] of Object.entries(raw)) {
    const v = validateRateItems(rows);
    if (!v.ok) return { ok: false, error: `${city}: ${v.error}` };
    byCity[city] = v.items;
  }
  return { ok: true, byCity };
}
