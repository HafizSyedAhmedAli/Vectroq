// apps/web/src/components/ClientGallery.test.tsx
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClientGallery } from "./ClientGallery";

const imgs = [
  { src: "/a.png", alt: "Front view" },
  { src: "/b.png", alt: "Side view" },
  { src: "/c.png", alt: "Rear view" },
];
const main = () =>
  document.querySelector("img.aspect-\\[5\\/4\\]") as HTMLImageElement;

describe("ClientGallery", () => {
  it("shows a single image without thumbnails, arrows or dots", () => {
    render(<ClientGallery images={[imgs[0]]} />);
    expect(main()).toHaveAttribute("alt", "Front view");
    expect(
      screen.queryByRole("button", { name: /show image/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Next image" }),
    ).not.toBeInTheDocument();
  });

  it("steps forward and wraps around at the end", async () => {
    render(<ClientGallery images={imgs} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Next image" }));
    expect(main()).toHaveAttribute("alt", "Side view");
    await user.click(screen.getByRole("button", { name: "Next image" }));
    await user.click(screen.getByRole("button", { name: "Next image" }));
    expect(main()).toHaveAttribute("alt", "Front view");
  });

  it("steps back and wraps around at the start", async () => {
    render(<ClientGallery images={imgs} />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Previous image" }));
    expect(main()).toHaveAttribute("alt", "Rear view");
  });

  it("jumps to a thumbnail", async () => {
    render(<ClientGallery images={imgs} />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Show image 3" }));
    expect(main()).toHaveAttribute("alt", "Rear view");
    expect(main()).toHaveAttribute("src", "/c.png");
  });

  it("requests fullscreen on the stage", () => {
    const req = vi.fn();
    HTMLElement.prototype.requestFullscreen = req;
    render(<ClientGallery images={imgs} />);
    fireEvent.click(screen.getByRole("button", { name: "View fullscreen" }));
    expect(req).toHaveBeenCalledTimes(1);
  });
});
