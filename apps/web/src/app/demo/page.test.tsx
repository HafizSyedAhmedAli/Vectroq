// apps/web/src/app/demo/page.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/auth/AuthShell", () => ({
  AuthShell: ({ title, subtitle, children, footer }: any) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
      <footer>{footer}</footer>
    </div>
  ),
}));
vi.mock("@/components/DemoStartButton", () => ({
  DemoStartButton: () => <button>start</button>,
}));

import DemoPage, { metadata } from "./page";

describe("Demo page", () => {
  it("has a title and tells visitors the demo is deleted after 24 hours", () => {
    expect(metadata.title).toBe("Try the demo · Vectroq");
    render(<DemoPage />);
    expect(
      screen.getByRole("heading", { name: "Try Vectroq" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/deleted after 24 hours/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "start" })).toBeInTheDocument();
  });

  it("offers sign-up to keep the work", () => {
    render(<DemoPage />);
    expect(
      screen.getByRole("link", { name: /create your company/i }),
    ).toHaveAttribute("href", "/signup");
  });
});
