// apps/web/src/components/SiteFooter.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteFooter } from "./SiteFooter";
import { platformBrand, type Brand } from "@/lib/brand";

const brand = (o: Partial<Brand> = {}): Brand => ({
  ...platformBrand,
  name: "Acme",
  logoUrl: null,
  tagline: "Built to last",
  contact: { phone: "0300 123 4567", email: "a@acme.co", website: "acme.co" },
  offices: [{ title: "HQ", address: "Karachi" }],
  ...o,
});

describe("SiteFooter", () => {
  it("builds contact links, adding https to a bare website and stripping spaces from the phone", () => {
    render(<SiteFooter brand={brand()} />);
    expect(screen.getByRole("link", { name: "Website" })).toHaveAttribute(
      "href",
      "https://acme.co",
    );
    expect(screen.getByRole("link", { name: "Website" })).toHaveAttribute(
      "target",
      "_blank",
    );
    expect(screen.getByRole("link", { name: "Email us" })).toHaveAttribute(
      "href",
      "mailto:a@acme.co",
    );
    expect(screen.getByRole("link", { name: "Call us" })).toHaveAttribute(
      "href",
      "tel:03001234567",
    );
  });

  it("keeps an existing scheme", () => {
    render(
      <SiteFooter brand={brand({ contact: { website: "http://acme.co" } })} />,
    );
    expect(screen.getByRole("link", { name: "Website" })).toHaveAttribute(
      "href",
      "http://acme.co",
    );
  });

  it("omits links and offices that aren't set", () => {
    render(<SiteFooter brand={brand({ contact: {}, offices: [] })} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText(/HQ:/)).not.toBeInTheDocument();
  });

  it("lists offices, the copyright with the current year, and the tagline", () => {
    render(<SiteFooter brand={brand()} />);
    expect(screen.getByText("HQ:")).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`© ${new Date().getFullYear()} Acme`)),
    ).toBeInTheDocument();
    expect(screen.getByText("Built to last")).toBeInTheDocument();
  });

  it("hides the tagline when empty", () => {
    render(<SiteFooter brand={brand({ tagline: "" })} />);
    expect(screen.queryByText("Built to last")).not.toBeInTheDocument();
  });
});
