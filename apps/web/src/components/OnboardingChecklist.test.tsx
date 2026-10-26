import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./LoadSampleButton", () => ({
  LoadSampleButton: () => <button>Load sample project</button>,
}));

import { OnboardingChecklist } from "./OnboardingChecklist";

const steps = [
  { id: "brand", title: "Add your logo", text: "Brand it", href: "/office/settings", cta: "Open settings", done: true },
  { id: "rates", title: "Review rates", text: "Check CSR", href: "/office/rates", cta: "Open rates", done: false },
  { id: "share", title: "Share your form", text: "Embed it", href: "/c/tm", cta: "Open form", done: false, external: true },
] as never[];

describe("OnboardingChecklist", () => {
  it("shows the progress count and width", () => {
    const { container } = render(<OnboardingChecklist steps={steps} canLoadSample={false} />);
    expect(screen.getByText("1 of 3 steps done")).toBeInTheDocument();
    const bar = container.querySelector("span.bg-brand") as HTMLElement;
    expect(bar.style.width).toBe(`${(1 / 3) * 100}%`);
  });

  it("lists every step; links only unfinished ones", () => {
    render(<OnboardingChecklist steps={steps} canLoadSample={false} />);
    expect(screen.getByText("Add your logo")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /open settings/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open rates/i })).toHaveAttribute("href", "/office/rates");
  });

  it("opens external steps in a new tab only", () => {
    render(<OnboardingChecklist steps={steps} canLoadSample={false} />);
    expect(screen.getByRole("link", { name: /open form/i })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: /open rates/i })).not.toHaveAttribute("target");
  });

  it("highlights only the next step", () => {
    render(<OnboardingChecklist steps={steps} canLoadSample={false} />);
    const items = screen.getAllByRole("listitem");
    expect(items[0].className).not.toContain("bg-brand/5");
    expect(items[1].className).toContain("bg-brand/5");
    expect(items[2].className).not.toContain("bg-brand/5");
  });

  it("numbers pending steps by position", () => {
    render(<OnboardingChecklist steps={steps} canLoadSample={false} />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows the sample button only when allowed", () => {
    const { unmount } = render(<OnboardingChecklist steps={steps} canLoadSample />);
    expect(screen.getByRole("button", { name: /load sample project/i })).toBeInTheDocument();
    unmount();
    render(<OnboardingChecklist steps={steps} canLoadSample={false} />);
    expect(screen.queryByRole("button", { name: /load sample project/i })).not.toBeInTheDocument();
  });

  it("handles everything done (no next step, no links)", () => {
    const all = steps.map((s) => ({ ...(s as object), done: true })) as never[];
    render(<OnboardingChecklist steps={all} canLoadSample={false} />);
    expect(screen.getByText("3 of 3 steps done")).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
