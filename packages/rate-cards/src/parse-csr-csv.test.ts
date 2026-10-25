import { describe, it, expect } from "vitest";
import { parseCsrCsv } from "./parse-csr-csv";

const HEADER = "city,itemType,unit,unitRate";

describe("parseCsrCsv", () => {
  it("parses rows grouped by city", () => {
    const r = parseCsrCsv(
      [
        HEADER,
        "Karachi,cement,bag,1400",
        "Karachi,sand,cft,60",
        "Lahore,cement,bag,1500",
      ].join("\n"),
    );
    expect(r).toEqual({
      ok: true,
      byCity: {
        Karachi: [
          { itemType: "cement", unit: "bag", unitRate: 1400 },
          { itemType: "sand", unit: "cft", unitRate: 60 },
        ],
        Lahore: [{ itemType: "cement", unit: "bag", unitRate: 1500 }],
      },
    });
  });

  it("handles CRLF, blank lines, whitespace and reordered columns", () => {
    const r = parseCsrCsv(
      "unitRate , unit,itemType, city\r\n\r\n 90 , bag , cement , Sukkur \r\n",
    );
    expect(r).toEqual({
      ok: true,
      byCity: { Sukkur: [{ itemType: "cement", unit: "bag", unitRate: 90 }] },
    });
  });

  it("rejects header-only and empty input", () => {
    expect(parseCsrCsv(HEADER)).toEqual({
      ok: false,
      error: "CSV has no data rows",
    });
    expect(parseCsrCsv("")).toEqual({ ok: false, error: "CSV has no data rows" });
  });

  it("reports missing columns", () => {
    const r = parseCsrCsv("city,unit\nKarachi,bag");
    expect(r).toEqual({
      ok: false,
      error: "Missing column(s): itemType, unitRate",
    });
  });

  it("rejects an empty city with its row number", () => {
    const r = parseCsrCsv(`${HEADER}\n,cement,bag,10`);
    expect(r).toEqual({ ok: false, error: "Row 2: city is empty" });
  });

  it("prefixes validation errors with the city", () => {
    const r = parseCsrCsv(`${HEADER}\nKarachi,gold,bag,10`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('Karachi: unknown itemType "gold"');
  });

  it("rejects non-numeric and non-positive rates", () => {
    expect(parseCsrCsv(`${HEADER}\nKarachi,cement,bag,abc`).ok).toBe(false);
    expect(parseCsrCsv(`${HEADER}\nKarachi,cement,bag,0`).ok).toBe(false);
  });

  it("rejects duplicate items within a city", () => {
    const r = parseCsrCsv(`${HEADER}\nA,cement,bag,1\nA,cement,bag,2`);
    expect(r).toEqual({ ok: false, error: 'A: duplicate item "cement"' });
  });
});
