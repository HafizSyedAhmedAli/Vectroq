// apps/web/src/lib/rate-basis.test.ts
import { describe, it, expect } from "vitest";
import { rateBasisLine, toRateBasisInfo } from "./rate-basis";

describe("toRateBasisInfo", () => {
  it("labels a CSR set with its document and year", () => {
    const info = toRateBasisInfo(
      {
        place: "Karachi",
        isFallback: false,
        origin: "csr",
        sources: { document: "Sindh CSR", year: 2026 },
      },
      "Karachi",
    );
    expect(info.label).toBe("Sindh CSR 2026");
    expect(rateBasisLine(info)).toBe("Rates: Sindh CSR 2026 (Karachi)");
  });

  it("labels manual sets without needing sources", () => {
    const info = toRateBasisInfo(
      { place: "Multan", isFallback: false, origin: "manual", sources: null },
      "Multan",
    );
    expect(info.label).toBe("Office-approved rates");
  });

  it("says so when another market's rates were used", () => {
    const info = toRateBasisInfo(
      {
        place: "Hyderabad",
        isFallback: true,
        origin: "csr",
        sources: { document: "Sindh CSR", year: 2026 },
      },
      "Nawabshah",
    );
    expect(rateBasisLine(info)).toBe(
      "Rates: Sindh CSR 2026, using Hyderabad rates (no rates loaded for Nawabshah)",
    );
  });

  it("tolerates a CSR set with no document name", () => {
    const info = toRateBasisInfo(
      { place: "Karachi", isFallback: false, origin: "csr", sources: {} },
      "Karachi",
    );
    expect(info.label).toBe("Composite Schedule of Rates");
  });
});
