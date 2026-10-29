import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DEFAULT_ORG_RULES } from "@vectroq/shared-types";

vi.mock("@/lib/org", () => ({ requirePage: vi.fn() }));
vi.mock("@/components/RulesForm", () => ({
  RulesForm: (p: unknown) => <pre data-testid="form">{JSON.stringify(p)}</pre>,
}));

import { requirePage } from "@/lib/org";
import RulesPage from "./page";

const as = (rules: unknown) =>
  (requirePage as any).mockResolvedValue({
    org: { rules, updatedAt: new Date("2026-10-20T08:30:00Z") },
  });
const initial = () =>
  JSON.parse(screen.getByTestId("form").textContent!).initial;

describe("Business rules page", () => {
  it("requires an owner", async () => {
    as(null);
    await RulesPage();
    expect(requirePage).toHaveBeenCalledWith("OWNER");
  });

  it("passes the default rules when none are stored", async () => {
    as(null);
    render(await RulesPage());
    expect(initial()).toEqual(JSON.parse(JSON.stringify(DEFAULT_ORG_RULES)));
  });

  it("fills gaps in stored rules with defaults", async () => {
    as({ models: { 2: { taxPercent: 8 } } });
    render(await RulesPage());
    expect(initial().models["2"].taxPercent).toBe(8);
    expect(initial().models["2"].label).toBe(DEFAULT_ORG_RULES.models[2].label);
  });

  it("falls back to defaults for invalid stored rules", async () => {
    as({ labour: { masonry: -5 } });
    render(await RulesPage());
    expect(initial().labour.masonry).toBe(DEFAULT_ORG_RULES.labour.masonry);
  });

  it("shows the heading and last-updated block", async () => {
    as(null);
    render(await RulesPage());
    expect(
      screen.getByRole("heading", { level: 1, name: "Business Rules" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Last updated")).toBeInTheDocument();
  });
});
