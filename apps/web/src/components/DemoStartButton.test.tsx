// apps/web/src/components/DemoStartButton.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

import { DemoStartButton } from "./DemoStartButton";

const fetchMock = vi.fn();
const res = (body: unknown = {}, status = 200) =>
  Promise.resolve({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  });

beforeEach(() => {
  [push, refresh, fetchMock].forEach((m) => m.mockReset());
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("DemoStartButton", () => {
  it("starts the demo and opens the dashboard", async () => {
    fetchMock.mockReturnValue(res({ ok: true }));
    render(<DemoStartButton />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /start the demo/i }));
    expect(fetchMock).toHaveBeenCalledWith("/api/demo/start", {
      method: "POST",
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/office/dashboard"));
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the busy label while starting", async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    render(<DemoStartButton />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /start the demo/i }));
    expect(
      screen.getByRole("button", { name: /preparing your demo/i }),
    ).toBeDisabled();
  });

  it("shows the server error and lets the visitor retry", async () => {
    fetchMock.mockReturnValue(
      res({ error: "The demo is busy right now." }, 503),
    );
    render(<DemoStartButton />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /start the demo/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The demo is busy right now.",
    );
    expect(
      screen.getByRole("button", { name: /start the demo/i }),
    ).toBeEnabled();
    expect(push).not.toHaveBeenCalled();
  });

  it("falls back to a generic error", async () => {
    fetchMock.mockReturnValue(
      Promise.resolve({
        ok: false,
        json: () => Promise.reject(new Error("x")),
      }),
    );
    render(<DemoStartButton />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /start the demo/i }));
    expect(
      await screen.findByText("Could not start the demo."),
    ).toBeInTheDocument();
  });
});
