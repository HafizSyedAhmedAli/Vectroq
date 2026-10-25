import { describe, it, expect } from "vitest";
import * as api from "./index";

describe("lead-intake index", () => {
  it("re-exports options, plan-file and validate-lead modules", () => {
    expect(Object.keys(api).length).toBeGreaterThan(0);
    for (const v of Object.values(api)) expect(v).toBeDefined();
    expect(typeof api.validateLeadIntake).toBe("function");
  });
});
