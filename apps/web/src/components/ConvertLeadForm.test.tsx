// apps/web/src/components/ConvertLeadForm.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvertLeadForm } from "./ConvertLeadForm";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function mockFetchOnce(response: { ok: boolean; json: unknown }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: response.ok,
        json: () => Promise.resolve(response.json),
      }),
    ),
  );
}

describe("ConvertLeadForm", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    push.mockClear();
  });

  it("creates a project from the lead's own details and navigates to it (FR-5)", async () => {
    mockFetchOnce({ ok: true, json: { id: "proj_1" } });
    render(
      <ConvertLeadForm
        leadId="lead_1"
        defaultCity="Hyderabad"
        defaultModel={2}
        defaultCategory="B"
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /create project/i }),
    );

    expect(fetch).toHaveBeenCalledWith(
      "/api/projects",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse((fetch as any).mock.calls[0][1].body as string);
    expect(body).toMatchObject({
      leadId: "lead_1",
      city: "Hyderabad",
      model: 2,
      category: "B",
    });
    expect(push).toHaveBeenCalledWith("/office/proj_1");
  });

  it("includes trimmed meeting notes when office adds them (FR-6)", async () => {
    mockFetchOnce({ ok: true, json: { id: "proj_1" } });
    render(
      <ConvertLeadForm
        leadId="lead_1"
        defaultCity="Karachi"
        defaultModel={1}
        defaultCategory="A"
      />,
    );

    await userEvent.type(
      screen.getByLabelText(/meeting notes/i),
      "  Client wants a walk-in shower.  ",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /create project/i }),
    );

    const body = JSON.parse((fetch as any).mock.calls[0][1].body as string);
    expect(body.meetingNotes).toBe("Client wants a walk-in shower.");
  });

  it("surfaces a server error without navigating away", async () => {
    mockFetchOnce({ ok: false, json: { error: "Lead not found" } });
    render(
      <ConvertLeadForm
        leadId="lead_1"
        defaultCity="Karachi"
        defaultModel={1}
        defaultCategory="A"
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /create project/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /lead not found/i,
    );
    expect(push).not.toHaveBeenCalled();
  });
});
