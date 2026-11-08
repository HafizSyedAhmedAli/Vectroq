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

const unitState = (o: object = {}, extra: object = {}) => ({
  unit: { feetPerUnit: 1, source: "header", confidence: "high", confirmed: false, needsConfirmation: false, unit: "foot", ...o },
  warnings: [],
  needsConfirmation: false,
  geometryEdited: false,
  ...extra,
});
const CONFIRMED = unitState();
const candidates = [
  { unit: "inch", insunits: 1, feetPerUnit: 1 / 12, widthFt: 3.3, heightFt: 2.5, plausible: false, reason: "" },
  { unit: "foot", insunits: 2, feetPerUnit: 1, widthFt: 40, heightFt: 30, plausible: true, reason: "" },
  { unit: "millimetre", insunits: 4, feetPerUnit: 0.0033, widthFt: 0.1, heightFt: 0.1, plausible: false, reason: "" },
  { unit: "centimetre", insunits: 5, feetPerUnit: 0.033, widthFt: 1.3, heightFt: 1, plausible: false, reason: "" },
  { unit: "metre", insunits: 6, feetPerUnit: 3.28, widthFt: 131, heightFt: 98, plausible: true, reason: "" },
];
const AMBIGUOUS = unitState(
  { source: "plausibility", confidence: "low", needsConfirmation: true, candidates },
  {
    needsConfirmation: true,
    warnings: [
      { code: "UNIT_AMBIGUOUS", severity: "warning", message: "More than one unit gives a plausible building size." },
      { code: "UNIT_CONFIRMATION_REQUIRED", severity: "warning", message: "Please select the drawing unit." },
    ],
  },
);

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

  it("uploads a DXF file and shows the extracted rooms for review", async () => {
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

  it("lets the team correct a room's area before calculating the BOQ", async () => {
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

  it("calculates and displays the BOQ", async () => {
    mockFetchSequence([
      // Phase 1B: the upload response carries the server's unit decision
      { ok: true, json: { geometry: GEOMETRY, unitState: CONFIRMED } },
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

  describe("unit confirmation (Phase 1B)", () => {
    const upload = async () =>
      userEvent.upload(
        screen.getByLabelText(/upload autocad file/i),
        new File(["dxf"], "plan.dxf"),
      );
    const calcBtn = () => screen.getByRole("button", { name: /calculate boq/i });

    it("shows warnings, every candidate with its size in feet, and the suggestion", async () => {
      mockFetchSequence([{ ok: true, json: { geometry: GEOMETRY, unitState: AMBIGUOUS } }]);
      render(<CadReviewPanel projectId="p1" />);
      await upload();

      const picker = await screen.findByTestId("unit-picker");
      expect(picker).toHaveTextContent(/confirm the drawing unit/i);
      expect(screen.getByLabelText("Unit warnings")).toHaveTextContent(/more than one unit gives a plausible/i);
      expect(picker).toHaveTextContent("40 × 30 ft");
      expect(picker).toHaveTextContent("131 × 98 ft");
      expect(picker).toHaveTextContent(/plausible building size/i);
      expect(screen.getAllByRole("radio")).toHaveLength(5);
      expect(screen.getByRole("radio", { name: /feet/i })).toBeChecked(); // the suggestion
    });

    it("prevents premature finalization: Calculate BOQ is disabled and sends nothing", async () => {
      mockFetchSequence([{ ok: true, json: { geometry: GEOMETRY, unitState: AMBIGUOUS } }]);
      render(<CadReviewPanel projectId="p1" />);
      await upload();
      await screen.findByTestId("unit-picker");

      expect(calcBtn()).toBeDisabled();
      expect(screen.getByText(/confirm the drawing unit to enable/i)).toBeInTheDocument();
      await userEvent.click(calcBtn());
      expect(fetch).toHaveBeenCalledTimes(1); // only the upload
    });

    it("lets the user override the suggestion; the choice goes to the confirm endpoint and unlocks Calculate", async () => {
      const newGeo = { ...GEOMETRY, walls: [{ ...GEOMETRY.walls[0], length: 131.2 }] };
      mockFetchSequence([
        { ok: true, json: { geometry: GEOMETRY, unitState: AMBIGUOUS } },
        { ok: true, json: { geometry: newGeo, unitState: unitState({ source: "user", confirmed: true, unit: "metre", feetPerUnit: 3.28 }) } },
      ]);
      render(<CadReviewPanel projectId="p1" />);
      await upload();
      await screen.findByTestId("unit-picker");

      await userEvent.click(screen.getByRole("radio", { name: /^metres/i })); // suggestion was feet
      await userEvent.click(screen.getByRole("button", { name: /confirm unit/i }));

      expect(await screen.findByTestId("unit-confirmed")).toHaveTextContent(/metres.*confirmed by you/i);
      const [url, init] = (fetch as any).mock.calls[1];
      expect(url).toBe("/api/projects/p1/cad-unit");
      expect(JSON.parse(init.body)).toEqual({ unit: "metre", replaceEditedGeometry: false });
      expect(calcBtn()).toBeEnabled();
      expect(screen.queryByTestId("unit-picker")).not.toBeInTheDocument();
    });

    it("displays a server 409 from finalize and brings the picker back", async () => {
      mockFetchSequence([
        { ok: true, json: { geometry: GEOMETRY, unitState: CONFIRMED } }, // client believes it's fine
        { ok: false, json: { error: "The drawing's unit is not confirmed. Choose the correct unit before calculating a BOQ.", code: "UNIT_CONFIRMATION_REQUIRED", reason: "needs-confirmation", unitState: AMBIGUOUS } },
      ]);
      render(<CadReviewPanel projectId="p1" />);
      await upload();
      await userEvent.click(await screen.findByRole("button", { name: /calculate boq/i }));

      expect(await screen.findByRole("alert")).toHaveTextContent(/unit is not confirmed/i);
      expect(await screen.findByTestId("unit-picker")).toBeInTheDocument();
      expect(calcBtn()).toBeDisabled();
    });

    it("a legacy drawing (no stored unit) explains itself and cannot be priced", () => {
      render(<CadReviewPanel projectId="p1" initialGeometry={GEOMETRY as any} initialUnit={null} />);
      expect(screen.getByTestId("unit-legacy")).toHaveTextContent(/units not verified/i);
      expect(screen.getByTestId("unit-legacy")).toHaveTextContent(/re-upload/i);
      expect(calcBtn()).toBeDisabled();
    });

    it("a drawing whose unit is already settled offers Calculate and a way to change the unit", () => {
      render(<CadReviewPanel projectId="p1" initialGeometry={GEOMETRY as any} initialUnit={CONFIRMED as any} />);
      expect(screen.getByTestId("unit-confirmed")).toHaveTextContent(/feet.*read from the drawing/i);
      expect(calcBtn()).toBeEnabled();
      expect(screen.getByRole("button", { name: /change unit/i })).toBeInTheDocument();
    });

    it("asks before discarding UNSAVED corrections, and only replaces them after an explicit decision", async () => {
      mockFetchSequence([
        { ok: true, json: { geometry: GEOMETRY, unitState: AMBIGUOUS } },
        { ok: true, json: { geometry: GEOMETRY, unitState: unitState({ source: "user", confirmed: true }) } },
      ]);
      render(<CadReviewPanel projectId="p1" />);
      await upload();
      const area = await screen.findByLabelText(/room 1 area/i);
      await userEvent.clear(area);
      await userEvent.type(area, "260");

      await userEvent.click(screen.getByRole("button", { name: /confirm unit/i }));
      expect(await screen.findByRole("alertdialog")).toHaveTextContent(/discard your corrections/i);
      expect(fetch).toHaveBeenCalledTimes(1); // nothing sent yet

      await userEvent.click(screen.getByRole("button", { name: /replace my corrections and apply feet/i }));
      await screen.findByTestId("unit-confirmed");
      expect(JSON.parse((fetch as any).mock.calls[1][1].body)).toEqual({ unit: "foot", replaceEditedGeometry: true });
    });

    it("cancelling the discard prompt sends nothing", async () => {
      mockFetchSequence([{ ok: true, json: { geometry: GEOMETRY, unitState: AMBIGUOUS } }]);
      render(<CadReviewPanel projectId="p1" />);
      await upload();
      await userEvent.type(await screen.findByLabelText(/room 1 name/i), "x");
      await userEvent.click(screen.getByRole("button", { name: /confirm unit/i }));
      await userEvent.click(await screen.findByRole("button", { name: /^cancel$/i }));
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("handles the server's MANUAL_EDITS_WOULD_BE_LOST for edits already saved", async () => {
      mockFetchSequence([
        { ok: false, json: { error: "This drawing has manual corrections.", code: "MANUAL_EDITS_WOULD_BE_LOST" } },
      ]);
      render(
        <CadReviewPanel
          projectId="p1"
          initialGeometry={GEOMETRY as any}
          initialUnit={{ ...AMBIGUOUS, geometryEdited: false } as any}
        />,
      );
      await userEvent.click(screen.getByRole("button", { name: /confirm unit/i }));
      expect(await screen.findByRole("alertdialog")).toHaveTextContent(/discard your corrections/i);
    });

    it("shows other server errors from the confirm endpoint", async () => {
      mockFetchSequence([
        { ok: false, json: { error: "The original DXF was not stored for this drawing.", code: "ORIGINAL_DXF_UNAVAILABLE" } },
      ]);
      render(<CadReviewPanel projectId="p1" initialGeometry={GEOMETRY as any} initialUnit={AMBIGUOUS as any} />);
      await userEvent.click(screen.getByRole("button", { name: /confirm unit/i }));
      expect(await screen.findByRole("alert")).toHaveTextContent(/original dxf was not stored/i);
      expect(calcBtn()).toBeDisabled();
    });
  });
});
