import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmbedCode } from "./EmbedCode";

describe("EmbedCode", () => {
  it("shows an iframe snippet for the slug using the current origin", async () => {
    const { container } = render(<EmbedCode slug="tm-construction" />);
    const text = container.querySelector("code")!.textContent!;
    expect(text).toContain("<iframe");
    expect(text).toContain(`src="${window.location.origin}/embed/tm-construction"`);
    expect(text).toContain('id="vectroq-form"');
    expect(text).toContain("vectroq:height");
    expect(text).toContain(`e.origin !== "${window.location.origin}"`);
  });

  it("copies the plain snippet and shows Copied", async () => {
    const user = userEvent.setup();
    const { container } = render(<EmbedCode slug="abc" />);
    await user.click(screen.getByRole("button", { name: /copy code/i }));
    expect(await screen.findByRole("button", { name: /copied/i })).toBeInTheDocument();
    const copied = await navigator.clipboard.readText();
    expect(copied).toContain("<iframe\n  id=\"vectroq-form\"");
    expect(copied).toContain("/embed/abc");
    expect(copied).toBe(
      Array.from(container.querySelectorAll("code > span"))
        .map((l) => l.textContent)
        .join("\n"),
    );
  });

  it("reverts the Copied label after 2 seconds", async () => {
    const user = userEvent.setup();
    render(<EmbedCode slug="abc" />);
    await user.click(screen.getByRole("button", { name: /copy code/i }));
    expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 2100));
    expect(screen.getByRole("button", { name: /copy code/i })).toBeInTheDocument();
  }, 10000);
});
