// apps/web/src/components/landing/landing-hooks.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { CountUp } from "./CountUp";
import { Reveal } from "./Reveal";

let trigger: (e: { isIntersecting: boolean }[]) => void;
const disconnect = vi.fn();
class IO {
  constructor(cb: (e: { isIntersecting: boolean }[]) => void) {
    trigger = cb;
  }
  observe() {}
  disconnect = disconnect;
}

beforeEach(() => {
  disconnect.mockClear();
  vi.stubGlobal("IntersectionObserver", IO);
});
afterEach(() => vi.unstubAllGlobals());

describe("Reveal", () => {
  it("is hidden until scrolled into view, then stays visible", () => {
    const { container } = render(<Reveal delay={120}>hi</Reveal>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).not.toContain("is-visible");
    expect(el.style.getPropertyValue("--d")).toBe("120ms");
    act(() => trigger([{ isIntersecting: false }]));
    expect(el.className).not.toContain("is-visible");
    act(() => trigger([{ isIntersecting: true }]));
    expect(el.className).toContain("is-visible");
    expect(disconnect).toHaveBeenCalled();
  });

  it("applies a custom class and renders children", () => {
    const { container } = render(<Reveal className="extra">content</Reveal>);
    expect(container.firstChild).toHaveClass("reveal", "extra");
    expect(screen.getByText("content")).toBeInTheDocument();
  });
});

describe("CountUp", () => {
  it("starts at zero with the prefix", () => {
    render(<CountUp to={1500} prefix="Rs " />);
    expect(screen.getByText("Rs 0")).toBeInTheDocument();
  });

  it("counts up to the target once visible, with thousands separators", async () => {
    render(<CountUp to={1500} prefix="Rs " duration={40} />);
    act(() => trigger([{ isIntersecting: true }]));
    await waitFor(() =>
      expect(screen.getByText("Rs 1,500")).toBeInTheDocument(),
    );
  });

  it("does nothing until it is visible", () => {
    render(<CountUp to={900} duration={40} />);
    act(() => trigger([{ isIntersecting: false }]));
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("stops observing on unmount", () => {
    render(<CountUp to={5} />).unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});
