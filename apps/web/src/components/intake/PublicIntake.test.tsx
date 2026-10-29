// apps/web/src/components/intake/PublicIntake.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/components/IntakeForm", async () => {
  const { useState } = await import("react");
  return {
    IntakeForm: ({ onSubmit }: any) => {
      const [out, setOut] = useState("");
      return (
        <>
          <button
            onClick={() =>
              onSubmit({ name: "Ali" }, null).then(
                (r: unknown) => setOut(JSON.stringify(r)),
                (e: Error) => setOut(`ERR:${e.message}`),
              )
            }
          >
            go
          </button>
          <p data-testid="out">{out}</p>
        </>
      );
    },
  };
});

import { PublicIntake } from "./PublicIntake";

const fetchMock = vi.fn();
const res = (body: unknown, status = 200) =>
  Promise.resolve({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  });
const models = {
  1: { label: "A", description: "" },
  2: { label: "B", description: "" },
  3: { label: "C", description: "" },
};
const categories = {
  A: { label: "Premium" },
  B: { label: "Standard" },
  C: { label: "Economy" },
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const setup = () =>
  render(
    <PublicIntake orgSlug="acme" models={models} categories={categories} />,
  );
const sent = () => JSON.parse(fetchMock.mock.calls[0][1].body);
const out = () => screen.getByTestId("out");

describe("PublicIntake", () => {
  it("posts the lead with the company slug and bot signals", async () => {
    fetchMock.mockReturnValue(res({ estimate: null }, 201));
    setup();
    await userEvent.setup().click(screen.getByRole("button", { name: "go" }));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/leads");
    expect(sent()).toMatchObject({ name: "Ali", orgSlug: "acme" });
    expect(sent().bot.website).toBe("");
    expect(typeof sent().bot.elapsedMs).toBe("number");
    expect(sent().bot.turnstileToken).toBe("");
  });

  it("returns the estimate to the form", async () => {
    fetchMock.mockReturnValue(res({ estimate: { total: 5 } }, 201));
    setup();
    await userEvent.setup().click(screen.getByRole("button", { name: "go" }));
    expect(await screen.findByText(/"total":5/)).toBeInTheDocument();
  });

  it("forwards a filled honeypot", async () => {
    fetchMock.mockReturnValue(res({ estimate: null }, 201));
    const { container } = setup();
    fireEvent.change(container.querySelector('input[name="website"]')!, {
      target: { value: "spam" },
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "go" }));
    expect(sent().bot.website).toBe("spam");
  });

  it("hides the honeypot from people and from tab order", () => {
    const { container } = setup();
    const input = container.querySelector('input[name="website"]')!;
    expect(input).toHaveAttribute("tabindex", "-1");
    expect(input.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("turns validation errors into one message", async () => {
    fetchMock.mockReturnValue(
      res({ errors: { city: "City is required.", planFile: "Too big." } }, 400),
    );
    setup();
    await userEvent.setup().click(screen.getByRole("button", { name: "go" }));
    expect(
      await screen.findByText(/ERR:City is required\. Too big\./),
    ).toBeInTheDocument();
  });

  it("uses the server's single error", async () => {
    fetchMock.mockReturnValue(res({ error: "Too many attempts." }, 429));
    setup();
    await userEvent.setup().click(screen.getByRole("button", { name: "go" }));
    expect(
      await screen.findByText("ERR:Too many attempts."),
    ).toBeInTheDocument();
  });

  it("falls back to a generic message", async () => {
    fetchMock.mockReturnValue(
      Promise.resolve({
        ok: false,
        json: () => Promise.reject(new Error("x")),
      }),
    );
    setup();
    await userEvent.setup().click(screen.getByRole("button", { name: "go" }));
    expect(
      await screen.findByText("ERR:Failed to submit lead"),
    ).toBeInTheDocument();
  });
});
