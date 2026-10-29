// apps/web/src/app/c/[slug]/page.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/org", () => ({ getOrgBySlug: vi.fn() }));
vi.mock("@/components/BrandLogo", () => ({ BrandLogo: () => null }));
vi.mock("@/components/BuildAnimation", () => ({ BuildAnimation: () => null }));
vi.mock("@/components/SiteFooter", () => ({ SiteFooter: () => null }));
vi.mock("@/components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("@/components/intake/PublicIntake", () => ({
  PublicIntake: (p: unknown) => (
    <pre data-testid="intake">{JSON.stringify(p)}</pre>
  ),
}));

import { getOrgBySlug } from "@/lib/org";
import OrgIntakePage, { generateMetadata } from "./page";

const org = {
  slug: "acme",
  name: "Acme Builders",
  tagline: null,
  logoUrl: null,
  primaryColor: "#2563EB",
  phone: "0300 111 2222",
  email: null,
  website: null,
  offices: [],
  rules: null,
};
const params = Promise.resolve({ slug: "acme" });

beforeEach(() => {
  vi.clearAllMocks();
  (getOrgBySlug as any).mockResolvedValue(org);
});

describe("Public intake page", () => {
  it("404s for an unknown company", async () => {
    (getOrgBySlug as any).mockResolvedValue(null);
    await expect(OrgIntakePage({ params })).rejects.toThrow("NOT_FOUND");
  });

  it("looks the company up by the URL slug", async () => {
    await OrgIntakePage({ params });
    expect(getOrgBySlug).toHaveBeenCalledWith("acme");
  });

  it("greets the visitor in the company's name and shows its phone", async () => {
    render(await OrgIntakePage({ params }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Request a Quote" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Tell Acme Builders about your project/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /0300 111 2222/ })).toHaveAttribute(
      "href",
      "tel:03001112222",
    );
  });

  it("gives the intake form the company slug and its own service types and categories", async () => {
    render(await OrgIntakePage({ params }));
    const p = JSON.parse(screen.getByTestId("intake").textContent!);
    expect(p.orgSlug).toBe("acme");
    expect(p.models["2"].label).toBe("Construction on Client's Plot");
    expect(p.categories.A.label).toBe("Premium");
  });

  it("builds the page title from the company name", async () => {
    expect(await generateMetadata({ params })).toEqual({
      title: "Request a quote · Acme Builders",
    });
  });

  it("uses a neutral title for an unknown company", async () => {
    (getOrgBySlug as any).mockResolvedValue(null);
    expect(await generateMetadata({ params })).toEqual({ title: "Not found" });
  });
});
