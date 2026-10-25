import { describe, it, expect } from "vitest";
import * as api from "./index";

describe("cad-parser index", () => {
  it("re-exports defined values", () => {
    expect(Object.keys(api).length).toBeGreaterThan(0);
    expect(typeof api.parseDxfToGeometry).toBe("function");
  });
});
