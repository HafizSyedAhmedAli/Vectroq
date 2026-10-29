// apps/web/src/app/embed/[slug]/page.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/org", () => ({ getOrgBySlug: vi.fn() }));
vi.mock("@/components/EmbedResizer", () => ({
  EmbedResizer: () => <div data-testid="resizer" />,
}));
vi.mock("@/components/intake/PublicIntake", () => ({
  PublicIntake: (p: any) => <div data-testid="intake" data-slug={p.orgSlug} />,
}));

import { getOrgBySlug } from "@/lib/org";
import EmbedPage from "./page";

const params = Promise.resolve({ slug: "acme" });

beforeEach(() => {
  vi.clearAllMocks();
  (getOrgBySlug as any).mockResolvedValue({
    slug: "acme",
    name: "Acme",
    tagline: null,
    logoUrl: null,
    primaryColor: "#0B1F44",
    phone: null,
    email: null,
    website: null,
    offices: [],
    rules: null,
  });
});

describe("Embed page", () => {
  it("404s for an unknown company", async () => {
    (getOrgBySlug as any).mockResolvedValue(null);
    await expect(EmbedPage({ params })).rejects.toThrow("NOT_FOUND");
  });

  it("renders the form with the company slug and the resizer", async () => {
    render(await EmbedPage({ params }));
    expect(screen.getByTestId("intake")).toHaveAttribute("data-slug", "acme");
    expect(screen.getByTestId("resizer")).toBeInTheDocument();
  });

  it("makes the page background transparent and applies the company colour", async () => {
    const { container } = render(await EmbedPage({ params }));
    expect(container.querySelector("style")!.textContent).toContain(
      "background:transparent!important",
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.getPropertyValue("--color-brand").toLowerCase()).toBe(
      "#0b1f44",
    );
  });
});
