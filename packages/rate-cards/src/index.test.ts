import { describe, it, expect } from "vitest";
import * as api from "./index";

describe("rate-cards index", () => {
  it("re-exports the public API", () => {
    for (const k of [
      "missingItemTypes",
      "isCompleteRateCard",
      "validateRateItems",
      "parseCsrCsv",
    ]) {
      expect(typeof (api as Record<string, unknown>)[k]).toBe("function");
    }
  });
});
