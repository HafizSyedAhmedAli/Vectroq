// packages/lead-intake/src/plan-file.test.ts
import { describe, it, expect } from "vitest";
import {
  PLAN_FILE_MAX_BYTES,
  planFileExtension,
  validatePlanFile,
} from "./plan-file";

describe("validatePlanFile", () => {
  it.each(["plan.pdf", "PLAN.DWG", "site.dxf", "a.jpg", "a.jpeg", "b.PNG"])(
    "accepts %s",
    (name) => {
      expect(validatePlanFile({ name, size: 1024 })).toBeNull();
    },
  );

  it("rejects unsupported and extension-less files", () => {
    expect(validatePlanFile({ name: "virus.exe", size: 10 })).toMatch(
      /unsupported/i,
    );
    expect(validatePlanFile({ name: "noextension", size: 10 })).toMatch(
      /unsupported/i,
    );
  });

  it("rejects empty and oversized files", () => {
    expect(validatePlanFile({ name: "a.pdf", size: 0 })).toMatch(/empty/i);
    expect(
      validatePlanFile({ name: "a.pdf", size: PLAN_FILE_MAX_BYTES + 1 }),
    ).toMatch(/10 MB/);
    expect(
      validatePlanFile({ name: "a.pdf", size: PLAN_FILE_MAX_BYTES }),
    ).toBeNull();
  });

  it("reads the extension case-insensitively", () => {
    expect(planFileExtension("My.Plan.PDF")).toBe("pdf");
  });
});
