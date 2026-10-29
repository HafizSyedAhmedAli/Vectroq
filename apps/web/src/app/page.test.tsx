// apps/web/src/app/page.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/landing/Reveal", () => ({
  Reveal: ({ children }: any) => <>{children}</>,
}));
vi.mock("@/components/landing/CountUp", () => ({
  CountUp: ({ to, prefix = "" }: any) => <span>{`${prefix}${to}`}</span>,
}));
vi.mock("@/components/ThemeToggle", () => ({ ThemeToggle: () => null }));

import LandingPage from "./page";

describe("Landing page", () => {
  it("has the product headline", () => {
    render(<LandingPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /from floor plan to final quote/i,
    );
  });

  it("sends visitors to the live demo and to sign-in", () => {
    render(<LandingPage />);
    for (const l of screen.getAllByRole("link", {
      name: /open the live demo|view 3d model|start now/i,
    }))
      expect(l).toHaveAttribute("href", "/demo");
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("links the nav and footer to the right sections", () => {
    render(<LandingPage />);
    for (const [name, href] of [
      ["Product", "#product"],
      ["How it works", "#how"],
      ["Sample BOQ", "#demo"],
      ["Pricing", "#pricing"],
    ]) {
      const links = screen.getAllByRole("link", { name });
      expect(links.length).toBeGreaterThanOrEqual(2);
      links.forEach((l) => expect(l).toHaveAttribute("href", href));
    }
  });

  it("shows the three plans with their calls to action", () => {
    render(<LandingPage />);
    for (const n of ["Starter", "Pro", "Business"])
      expect(screen.getByRole("heading", { name: n })).toBeInTheDocument();
    expect(screen.getByText("Rs 4,999")).toBeInTheDocument();
    expect(screen.getByText("Rs 14,999")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start free" })).toHaveAttribute(
      "href",
      "/signup",
    );
    expect(screen.getByRole("link", { name: "Get Pro" })).toHaveAttribute(
      "href",
      "/signup",
    );
    expect(screen.getByRole("link", { name: "Talk to us" })).toHaveAttribute(
      "href",
      "/request",
    );
  });

  it("marks only the Pro plan as most popular", () => {
    render(<LandingPage />);
    expect(screen.getAllByText("Most popular")).toHaveLength(1);
  });

  it("lists the sample BOQ lines and the four process steps", () => {
    render(<LandingPage />);
    expect(screen.getByText("Brick masonry (labour)")).toBeInTheDocument();
    for (const s of [
      "Upload a plan",
      "Review what we read",
      "Get a priced BOQ",
      "Share with your client",
    ])
      expect(screen.getByRole("heading", { name: s })).toBeInTheDocument();
  });
});
