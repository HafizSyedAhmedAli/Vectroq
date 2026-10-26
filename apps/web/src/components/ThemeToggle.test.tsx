import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "./ThemeToggle";

function mockMatchMedia(dark: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: dark, media: q, addEventListener() {}, removeEventListener() {} }));
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  mockMatchMedia(false);
});
afterEach(() => vi.unstubAllGlobals());

describe("ThemeToggle", () => {
  it("starts light when there is no saved or system preference", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toHaveAttribute("aria-pressed", "false");
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("follows the system dark preference", () => {
    mockMatchMedia(true);
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeInTheDocument();
    expect(document.documentElement).toHaveClass("dark");
  });

  it("prefers the saved choice over the system", () => {
    mockMatchMedia(true);
    localStorage.setItem("vq_theme", "light");
    render(<ThemeToggle />);
    expect(document.documentElement).not.toHaveClass("dark");
    localStorage.setItem("vq_theme", "dark");
  });

  it("toggles, updates the html class and saves", async () => {
    render(<ThemeToggle />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Switch to dark mode" }));
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("vq_theme")).toBe("dark");
    await user.click(screen.getByRole("button", { name: "Switch to light mode" }));
    expect(document.documentElement).not.toHaveClass("dark");
    expect(localStorage.getItem("vq_theme")).toBe("light");
  });

  it("removes the dark class on unmount", async () => {
    localStorage.setItem("vq_theme", "dark");
    const { unmount } = render(<ThemeToggle />);
    expect(document.documentElement).toHaveClass("dark");
    unmount();
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("works when localStorage throws", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    render(<ThemeToggle />);
    await userEvent.setup().click(screen.getByRole("button"));
    expect(document.documentElement).toHaveClass("dark");
    vi.restoreAllMocks();
  });

  it("applies a custom className", () => {
    render(<ThemeToggle className="extra" />);
    expect(screen.getByRole("button").className).toContain("extra");
  });
});
