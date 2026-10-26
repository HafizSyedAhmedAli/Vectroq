import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrandLogo } from "./BrandLogo";
import { platformBrand } from "@/lib/brand";

describe("BrandLogo", () => {
  it("renders an image with alt text when there is a logo", () => {
    render(<BrandLogo brand={{ ...platformBrand, name: "TM", logoUrl: "/l.png" }} />);
    const img = screen.getByRole("img", { name: "TM" });
    expect(img).toHaveAttribute("src", "/l.png");
    expect(img.className).toContain("h-11 w-auto");
    expect(img.className).toContain("vq-logo");
  });

  it("accepts a custom class", () => {
    render(<BrandLogo brand={{ ...platformBrand, logoUrl: "/l.png" }} className="h-20" />);
    expect(screen.getByRole("img").className).toContain("h-20");
  });

  it("falls back to the brand name as text without a logo", () => {
    render(<BrandLogo brand={{ ...platformBrand, name: "TM Construction", logoUrl: null }} />);
    expect(screen.getByText("TM Construction")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
