// apps/web/src/components/decor.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrandHero } from "./BrandHero";
import { CompanyIllustration, IsoBox } from "./CompanyIllustration";

describe("BrandHero", () => {
  it("is decorative and lists the three product chips", () => {
    const { container } = render(<BrandHero />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
    for (const t of ["3D model", "Priced BOQ", "Approved rates"])
      expect(screen.getByText(t)).toBeInTheDocument();
  });
});

describe("CompanyIllustration", () => {
  it("is decorative and accepts a size class", () => {
    const { container } = render(<CompanyIllustration className="h-36" />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
    expect(container.firstChild).toHaveClass("h-36");
  });

  it("draws three faces per building plus floor lines", () => {
    const { container } = render(
      <svg>
        <IsoBox cx={100} cy={100} a={20} h={60} />
      </svg>,
    );
    expect(container.querySelectorAll("polygon")).toHaveLength(3);
    expect(container.querySelectorAll("line").length).toBeGreaterThan(0);
  });
});
