// apps/web/src/components/auth/AuthShell.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/image", () => ({
  default: (p: any) => <img alt={p.alt} src={p.src} />,
}));
vi.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => <button>theme</button>,
}));

import { AuthShell } from "./AuthShell";

describe("AuthShell", () => {
  it("shows the title, subtitle and children", () => {
    render(
      <AuthShell title="Welcome back" subtitle="Sign in to continue.">
        <form>inner form</form>
      </AuthShell>,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sign in to continue.")).toBeInTheDocument();
    expect(screen.getByText("inner form")).toBeInTheDocument();
  });

  it("renders the footer under an OR divider only when given", () => {
    const { rerender } = render(
      <AuthShell title="t" subtitle="s">
        x
      </AuthShell>,
    );
    expect(screen.queryByText("OR")).not.toBeInTheDocument();
    rerender(
      <AuthShell title="t" subtitle="s" footer={<a href="/signup">Create</a>}>
        x
      </AuthShell>,
    );
    expect(screen.getByText("OR")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create" })).toBeInTheDocument();
  });

  it("shows the theme toggle only when asked", () => {
    const { rerender } = render(
      <AuthShell title="t" subtitle="s">
        x
      </AuthShell>,
    );
    expect(
      screen.queryByRole("button", { name: "theme" }),
    ).not.toBeInTheDocument();
    rerender(
      <AuthShell title="t" subtitle="s" themeToggle>
        x
      </AuthShell>,
    );
    expect(screen.getByRole("button", { name: "theme" })).toBeInTheDocument();
  });

  it("shows the product pitch", () => {
    render(
      <AuthShell title="t" subtitle="s">
        x
      </AuthShell>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /from floor plan to final quote/i,
    );
    for (const f of ["Fast Quotations", "Accurate BOQs", "3D Visualization"])
      expect(screen.getByText(f)).toBeInTheDocument();
  });
});
