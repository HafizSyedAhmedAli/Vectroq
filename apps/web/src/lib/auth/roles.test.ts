import { describe, it, expect } from "vitest";
import { hasRole, isRole } from "./roles";

describe("roles", () => {
  it("orders VIEWER < ESTIMATOR < OWNER", () => {
    expect(hasRole("OWNER", "ESTIMATOR")).toBe(true);
    expect(hasRole("ESTIMATOR", "ESTIMATOR")).toBe(true);
    expect(hasRole("VIEWER", "ESTIMATOR")).toBe(false);
    expect(hasRole("ESTIMATOR", "OWNER")).toBe(false);
  });
  it("rejects unknown roles", () => {
    expect(isRole("ADMIN")).toBe(false);
    expect(isRole("OWNER")).toBe(true);
  });
});
