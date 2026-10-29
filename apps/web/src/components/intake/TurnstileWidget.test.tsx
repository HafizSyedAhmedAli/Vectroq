// apps/web/src/components/intake/TurnstileWidget.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { TurnstileWidget } from "./TurnstileWidget";

const renderFn = vi.fn(() => "widget-1");
const removeFn = vi.fn();

beforeEach(() => {
  renderFn.mockClear();
  removeFn.mockClear();
  (window as any).turnstile = { render: renderFn, remove: removeFn };
});
afterEach(() => delete (window as any).turnstile);

const opts = () => (renderFn.mock.calls[0] as any)[1];

describe("TurnstileWidget", () => {
  it("renders the challenge with the site key", async () => {
    render(<TurnstileWidget siteKey="site-key" onToken={() => {}} />);
    await waitFor(() => expect(renderFn).toHaveBeenCalled());
    expect(opts().sitekey).toBe("site-key");
  });

  it("reports the token and hides itself once verified", async () => {
    const onToken = vi.fn();
    const { container } = render(
      <TurnstileWidget siteKey="k" onToken={onToken} />,
    );
    await waitFor(() => expect(renderFn).toHaveBeenCalled());
    act(() => opts().callback("tok"));
    expect(onToken).toHaveBeenCalledWith("tok");
    expect((container.firstChild as HTMLElement).className).toContain("hidden");
  });

  it("reappears when the token expires or errors", async () => {
    const onToken = vi.fn();
    const { container } = render(
      <TurnstileWidget siteKey="k" onToken={onToken} />,
    );
    await waitFor(() => expect(renderFn).toHaveBeenCalled());
    act(() => opts().callback("tok"));
    act(() => opts()["expired-callback"]());
    expect(onToken).toHaveBeenLastCalledWith("");
    expect((container.firstChild as HTMLElement).className).not.toContain(
      "hidden",
    );
    act(() => opts().callback("tok2"));
    act(() => opts()["error-callback"]());
    expect(onToken).toHaveBeenLastCalledWith("");
  });

  it("removes the widget on unmount", async () => {
    const { unmount } = render(
      <TurnstileWidget siteKey="k" onToken={() => {}} />,
    );
    await waitFor(() => expect(renderFn).toHaveBeenCalled());
    unmount();
    expect(removeFn).toHaveBeenCalledWith("widget-1");
  });
});
