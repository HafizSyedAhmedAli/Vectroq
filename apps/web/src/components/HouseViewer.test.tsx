import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Geometry } from "@vectroq/shared-types";

vi.mock("@react-three/fiber", () => ({
  Canvas: () => <canvas data-testid="canvas" />,
  useFrame: () => {},
  useThree: () => ({}),
}));
vi.mock("@react-three/drei", () => ({
  Environment: () => null,
  Lightformer: () => null,
  OrbitControls: () => null,
  Sky: () => null,
  Text: () => null,
}));
vi.mock("@react-three/postprocessing", () => ({
  EffectComposer: () => null,
  N8AO: () => null,
  SMAA: () => null,
  ToneMapping: () => null,
}));

import { HouseViewer } from "./HouseViewer";

const geometry: Geometry = {
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
    {
      id: "w2",
      startX: 20,
      startY: 0,
      endX: 20,
      endY: 12,
      length: 12,
      height: 10,
      thickness: 0.75,
    },
  ],
  rooms: [{ id: "r1", name: "Living Room", area: 240, type: "general" }],
  openings: [],
};

const toggle = (name: string) =>
  screen.getByLabelText(name) as HTMLInputElement;

beforeEach(() => {
  HTMLElement.prototype.requestFullscreen = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

describe("HouseViewer toolbar", () => {
  it("lists the finishes for the chosen category", () => {
    render(
      <HouseViewer geometry={geometry} category="A" livingFloor="marble" />,
    );
    expect(screen.getByText("Category A finishes")).toBeInTheDocument();
    expect(
      screen.getByText("Stepped false ceiling with cove light"),
    ).toBeInTheDocument();
    expect(screen.getByText(/marble in dry rooms/i)).toBeInTheDocument();
  });

  it("falls back to category B finishes for an unknown category", () => {
    render(<HouseViewer geometry={geometry} category={"Z" as never} />);
    expect(screen.getByText("Oak doors (illustrative)")).toBeInTheDocument();
  });

  it("has sensible defaults for the toggles", () => {
    render(<HouseViewer geometry={geometry} />);
    expect(toggle("Labels")).toBeChecked();
    expect(toggle("Furniture")).toBeChecked();
    expect(toggle("Surroundings")).toBeChecked();
    expect(toggle("Link rooms")).toBeChecked();
    expect(toggle("Ceilings")).not.toBeChecked();
    expect(toggle("Open doors")).not.toBeChecked();
    expect(toggle("Soft shadows")).not.toBeChecked();
  });

  it("flips a toggle", async () => {
    render(<HouseViewer geometry={geometry} />);
    await userEvent.setup().click(toggle("Ceilings"));
    expect(toggle("Ceilings")).toBeChecked();
  });

  it("switches between Day and Night", async () => {
    render(<HouseViewer geometry={geometry} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /night/i }));
    expect(screen.getByRole("button", { name: /day/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("2D plan disables the roof buttons and ceilings", async () => {
    render(<HouseViewer geometry={geometry} />);
    const user = userEvent.setup();
    expect(screen.getByRole("button", { name: "Roof" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "2D plan" }));
    expect(screen.getByRole("button", { name: "Roof" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Lift roof" })).toBeDisabled();
    expect(toggle("Ceilings")).toBeDisabled();
  });

  it("the cut-height slider only works in 3D", async () => {
    render(<HouseViewer geometry={geometry} />);
    const slider = screen.getByLabelText("Cut the house open at a height");
    expect(slider).toBeEnabled();
    await userEvent.setup().click(screen.getByRole("button", { name: "Walk" }));
    expect(slider).toBeDisabled();
  });

  it("walk mode shows help, the touch pad, and enables the FOV slider", async () => {
    render(<HouseViewer geometry={geometry} />);
    const fov = screen.getByLabelText("Field of view in walk mode");
    expect(fov).toBeDisabled();
    expect(
      screen.queryByText(/walk mode: drag to look around/i),
    ).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "Walk" }));
    expect(
      screen.getByText(/walk mode: drag to look around/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Walk forward" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Turn left" }),
    ).toBeInTheDocument();
    expect(fov).toBeEnabled();
    expect(screen.getByText("FOV 75°")).toBeInTheDocument();

    fireEvent.change(fov, { target: { value: "90" } });
    expect(screen.getByText("FOV 90°")).toBeInTheDocument();
  });

  it("the roof button group disables in walk mode too", async () => {
    render(<HouseViewer geometry={geometry} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Walk" }));
    expect(screen.getByRole("button", { name: "No roof" })).toBeDisabled();
  });

  it("downloads the canvas as a PNG", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/png;base64,xx",
    );
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    render(<HouseViewer geometry={geometry} />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /download/i }));
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("does nothing on download when the canvas gives no data", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("");
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    render(<HouseViewer geometry={geometry} />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /download/i }));
    expect(click).not.toHaveBeenCalled();
  });

  it("requests fullscreen", async () => {
    render(<HouseViewer geometry={geometry} />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /^fullscreen$/i }));
    expect(HTMLElement.prototype.requestFullscreen).toHaveBeenCalled();
  });

  it("renders for a drawing with no walls", () => {
    render(<HouseViewer geometry={{ walls: [], rooms: [], openings: [] }} />);
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
  });
});
