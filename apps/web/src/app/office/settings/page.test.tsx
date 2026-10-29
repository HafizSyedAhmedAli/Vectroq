import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/org", () => ({ requirePage: vi.fn() }));
vi.mock("@/components/OrgSettingsForm", () => ({
  OrgSettingsForm: (p: unknown) => (
    <pre data-testid="form">{JSON.stringify(p)}</pre>
  ),
}));
vi.mock("@/components/EmbedCode", () => ({
  EmbedCode: ({ slug }: { slug: string }) => (
    <div data-testid="embed">{slug}</div>
  ),
}));

import { requirePage } from "@/lib/org";
import SettingsPage from "./page";

const org = (o: Record<string, unknown> = {}) => ({
  slug: "acme",
  name: "Acme",
  tagline: null,
  logoUrl: null,
  primaryColor: "#0B1F44",
  phone: null,
  email: null,
  website: null,
  offices: [],
  ...o,
});
const initial = () =>
  JSON.parse(screen.getByTestId("form").textContent!).initial;

describe("Settings page", () => {
  it("requires an owner", async () => {
    (requirePage as any).mockResolvedValue({ org: org() });
    await SettingsPage();
    expect(requirePage).toHaveBeenCalledWith("OWNER");
  });

  it("turns null fields into empty strings", async () => {
    (requirePage as any).mockResolvedValue({ org: org() });
    render(await SettingsPage());
    expect(initial()).toEqual({
      name: "Acme",
      tagline: "",
      primaryColor: "#0B1F44",
      phone: "",
      email: "",
      website: "",
      logoUrl: null,
      offices: [],
    });
  });

  it("passes stored values and offices through, and the slug to the embed code", async () => {
    (requirePage as any).mockResolvedValue({
      org: org({
        tagline: "Built to last",
        phone: "0300",
        logoUrl: "http://l.png",
        offices: [{ title: "HQ", address: "Karachi" }],
      }),
    });
    render(await SettingsPage());
    expect(initial()).toMatchObject({
      tagline: "Built to last",
      phone: "0300",
      logoUrl: "http://l.png",
      offices: [{ title: "HQ", address: "Karachi" }],
    });
    expect(screen.getByTestId("embed")).toHaveTextContent("acme");
  });

  it("ignores a non-array offices value", async () => {
    (requirePage as any).mockResolvedValue({ org: org({ offices: null }) });
    render(await SettingsPage());
    expect(initial().offices).toEqual([]);
  });
});
