// apps/web/src/components/ProjectWorkspace.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/components/CardReviewPanel", () => ({
  CadReviewPanel: (p: any) => (
    <div>
      <span data-testid="panel-props">
        {JSON.stringify({
          id: p.projectId,
          show: p.showBoq,
          file: p.initialFileName,
        })}
      </span>
      <button
        onClick={() =>
          p.onGeometryChange({ walls: [], rooms: [], openings: [] })
        }
      >
        geo
      </button>
      <button onClick={() => p.onBoqChange({ total: 1 })}>boq</button>
      <button onClick={() => p.onBoqChange(null)}>clear</button>
    </div>
  ),
}));
vi.mock("@/components/BoqTable", () => ({
  BoqTable: () => <div>boq-table</div>,
}));
vi.mock("@/components/ViewerPanel", () => ({
  ViewerPanel: (p: any) => (
    <div data-testid="viewer">{p.geometry ? "has-geo" : "no-geo"}</div>
  ),
}));

import { ProjectWorkspace } from "./ProjectWorkspace";

const geo = { walls: [], rooms: [], openings: [] };
beforeEach(() => refresh.mockReset());

describe("ProjectWorkspace", () => {
  it("starts empty: placeholder BOQ, no 3D model, no print link", () => {
    render(
      <ProjectWorkspace
        projectId="p1"
        initialGeometry={null}
        initialBoq={null}
      />,
    );
    expect(screen.getByText("No BOQ yet")).toBeInTheDocument();
    expect(screen.getByTestId("viewer")).toHaveTextContent("no-geo");
    expect(
      screen.queryByRole("link", { name: /print/i }),
    ).not.toBeInTheDocument();
  });

  it("starts populated: BOQ table, model and print link", () => {
    render(
      <ProjectWorkspace
        projectId="p1"
        initialGeometry={geo}
        initialBoq={{ total: 5 } as never}
      />,
    );
    expect(screen.getByText("boq-table")).toBeInTheDocument();
    expect(screen.getByTestId("viewer")).toHaveTextContent("has-geo");
    expect(
      screen.getByRole("link", { name: /print \/ save pdf/i }),
    ).toHaveAttribute("href", "/office/p1/boq");
  });

  it("hands the panel the project id and stops it rendering its own BOQ", () => {
    render(
      <ProjectWorkspace
        projectId="p9"
        initialGeometry={geo}
        initialBoq={null}
        initialFileName="a.dxf"
      />,
    );
    expect(JSON.parse(screen.getByTestId("panel-props").textContent!)).toEqual({
      id: "p9",
      show: false,
      file: "a.dxf",
    });
  });

  it("updates the 3D model when the panel reports new geometry", async () => {
    render(
      <ProjectWorkspace
        projectId="p1"
        initialGeometry={null}
        initialBoq={null}
      />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "geo" }));
    expect(screen.getByTestId("viewer")).toHaveTextContent("has-geo");
  });

  it("shows a new BOQ, refreshes the page, and goes back to the placeholder when cleared", async () => {
    render(
      <ProjectWorkspace
        projectId="p1"
        initialGeometry={geo}
        initialBoq={null}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "boq" }));
    expect(screen.getByText("boq-table")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "clear" }));
    expect(screen.getByText("No BOQ yet")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("shows the last-updated badge only when given", () => {
    const { rerender } = render(
      <ProjectWorkspace
        projectId="p1"
        initialGeometry={geo}
        initialBoq={null}
      />,
    );
    expect(screen.queryByText(/last updated/i)).not.toBeInTheDocument();
    rerender(
      <ProjectWorkspace
        projectId="p1"
        initialGeometry={geo}
        initialBoq={null}
        updatedLabel="1 Oct 2026"
      />,
    );
    expect(screen.getByText(/last updated 1 Oct 2026/i)).toBeInTheDocument();
  });
});
