// apps/web/src/components/CadReviewPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CadReviewPanel } from "./CardReviewPanel";

const GEOMETRY = {
  rooms: [{ id: "r1", name: "Kitchen", area: 240, type: "kitchen" }],
  walls: [
    {
      id: "w1",
      startX: 0,
      startY: 0,
      endX: 20,
      endY: 0,
      length: 20,
      height: 10,
      thickness: 0.75,
    },
  ],
  openings: [],
};

function mockFetchSequence(responses: Array<{ ok: boolean; json: unknown }>) {
  let call = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      const r = responses[Math.min(call, responses.length - 1)];
      call++;
      return Promise.resolve({ ok: r.ok, json: () => Promise.resolve(r.json) });
    }),
  );
}

describe("CadReviewPanel", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("uploads a DXF file and shows the extracted rooms for review (FR-9/10)", async () => {
    mockFetchSequence([{ ok: true, json: { geometry: GEOMETRY } }]);
    render(<CadReviewPanel projectId="p1" />);

    const file = new File(["dxf content"], "plan.dxf", {
      type: "application/dxf",
    });
    await userEvent.upload(screen.getByLabelText(/upload autocad file/i), file);

    expect(await screen.findByLabelText(/room 1 name/i)).toHaveValue("Kitchen");
    expect(fetch).toHaveBeenCalledWith(
      "/api/projects/p1/cad-upload",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("surfaces the server's error message when a file can't be parsed", async () => {
    // Note: userEvent.upload respects the input's accept=".dxf" attribute
    // and silently drops non-matching files (e.g. a .dwg), so that
    // rejection path is exercised at the route level (cad-upload/route.test.ts)
    // instead — this covers what a user actually can submit through the UI:
    // a .dxf-named file the parser still can't make sense of.
    mockFetchSequence([
      { ok: false, json: { error: "Could not parse this DXF file." } },
    ]);
    render(<CadReviewPanel projectId="p1" />);

    await userEvent.upload(
      screen.getByLabelText(/upload autocad file/i),
      new File(["not a real dxf"], "plan.dxf"),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not parse/i,
    );
  });

  it("lets office staff correct a room's area before calculating the BOQ (FR-10/14)", async () => {
    mockFetchSequence([
      { ok: true, json: { geometry: GEOMETRY } },
      { ok: true, json: { id: "cad_1" } }, // PATCH /geometry response
    ]);
    render(<CadReviewPanel projectId="p1" />);

    await userEvent.upload(
      screen.getByLabelText(/upload autocad file/i),
      new File(["dxf"], "plan.dxf"),
    );
    const areaInput = await screen.findByLabelText(/room 1 area/i);

    await userEvent.clear(areaInput);
    await userEvent.type(areaInput, "260");
    await userEvent.click(
      screen.getByRole("button", { name: /save corrections/i }),
    );

    expect(fetch).toHaveBeenLastCalledWith(
      "/api/projects/p1/geometry",
      expect.objectContaining({ method: "PATCH" }),
    );
    const patchBody = JSON.parse(
      (fetch as any).mock.calls[1][1].body as string,
    );
    expect(patchBody.rooms[0].area).toBe(260);
  });

  it("calculates and displays the BOQ (FR-11/12/13)", async () => {
    mockFetchSequence([
      { ok: true, json: { geometry: GEOMETRY } },
      {
        ok: true,
        json: {
          boq: {
            lineItems: [
              {
                itemType: "tileFixing",
                quantity: 240,
                unit: "sqft",
                unitRate: 220,
                subtotal: 52800,
              },
            ],
            subtotal: 52800,
            tax: 8976,
            total: 61776,
          },
        },
      },
    ]);
    render(<CadReviewPanel projectId="p1" />);

    await userEvent.upload(
      screen.getByLabelText(/upload autocad file/i),
      new File(["dxf"], "plan.dxf"),
    );
    await screen.findByLabelText(/room 1 name/i);

    await userEvent.click(
      screen.getByRole("button", { name: /calculate boq/i }),
    );

    // Anchored so this doesn't also match the "Subtotal:" line above it.
    expect(
      await screen.findByText(/total estimated cost/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/tile flooring/i)).toBeInTheDocument();
    expect(screen.getByText("Rs 61,776")).toBeInTheDocument();
    expect(fetch).toHaveBeenLastCalledWith("/api/projects/p1/finalize", {
      method: "POST",
    });
  });
});
