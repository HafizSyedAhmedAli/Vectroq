// apps/web/src/components/EmbedResizer.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { EmbedResizer } from "./EmbedResizer";

let trigger: () => void;
const disconnect = vi.fn();
class RO {
  constructor(cb: () => void) {
    trigger = cb;
  }
  observe() {}
  disconnect = disconnect;
}

beforeEach(() => {
  disconnect.mockClear();
  vi.stubGlobal("ResizeObserver", RO);
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    value: 640,
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("EmbedResizer", () => {
  it("tells the host page its height on mount", () => {
    const post = vi
      .spyOn(window.parent, "postMessage")
      .mockImplementation(() => {});
    render(<EmbedResizer />);
    expect(post).toHaveBeenCalledWith(
      { type: "vectroq:height", height: 640 },
      "*",
    );
  });

  it("tells it again whenever the content resizes", () => {
    const post = vi
      .spyOn(window.parent, "postMessage")
      .mockImplementation(() => {});
    render(<EmbedResizer />);
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 900,
    });
    trigger();
    expect(post).toHaveBeenLastCalledWith(
      { type: "vectroq:height", height: 900 },
      "*",
    );
  });

  it("stops observing on unmount", () => {
    vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    render(<EmbedResizer />).unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});
