import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { BuildAnimation } from "./BuildAnimation";

function stubMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: reduce,
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe("BuildAnimation", () => {
  it("starts at 'Breaking ground' and steps through the build", () => {
    stubMotion(false);
    render(<BuildAnimation />);
    expect(screen.getByText("Starting")).toBeInTheDocument();
    expect(screen.getByText("Breaking ground")).toBeInTheDocument();
    tick(700);
    expect(screen.getByText("Step 1 of 8")).toBeInTheDocument();
    expect(screen.getByText("Marking the plot")).toBeInTheDocument();
    tick(1200);
    expect(screen.getByText("Pouring the foundation")).toBeInTheDocument();
  });

  it("loops back to the start after the finished pause", () => {
    stubMotion(false);
    render(<BuildAnimation />);
    const total = [700, 1200, 1300, 1900, 1900, 1500, 1300, 2000];
    total.forEach((ms) => tick(ms));
    expect(screen.getByText("Ready for your quote")).toBeInTheDocument();
    tick(4500);
    expect(screen.getByText("Breaking ground")).toBeInTheDocument();
  });

  it("shows the finished house at once when the user prefers reduced motion", () => {
    stubMotion(true);
    render(<BuildAnimation />);
    expect(screen.getByText("Step 8 of 8")).toBeInTheDocument();
    expect(screen.getByText("Ready for your quote")).toBeInTheDocument();
    tick(20_000);
    expect(screen.getByText("Step 8 of 8")).toBeInTheDocument();
  });

  it("replay restarts from the beginning", () => {
    stubMotion(false);
    render(<BuildAnimation />);
    tick(700 + 1200);
    expect(screen.getByText("Step 2 of 8")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Replay the build" }));
    expect(screen.getByText("Breaking ground")).toBeInTheDocument();
  });

  it("replay keeps the finished state under reduced motion", () => {
    stubMotion(true);
    render(<BuildAnimation />);
    fireEvent.click(screen.getByRole("button", { name: "Replay the build" }));
    expect(screen.getByText("Step 8 of 8")).toBeInTheDocument();
  });

  it("requests fullscreen on the container", () => {
    stubMotion(false);
    const req = vi.fn();
    HTMLElement.prototype.requestFullscreen = req;
    render(<BuildAnimation />);
    fireEvent.click(screen.getByRole("button", { name: "View fullscreen" }));
    expect(req).toHaveBeenCalledTimes(1);
  });

  it("has an accessible description of the picture", () => {
    stubMotion(false);
    render(<BuildAnimation />);
    expect(
      screen.getByRole("img", { name: /house being built/i }),
    ).toBeInTheDocument();
  });
});
