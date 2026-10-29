// apps/web/src/app/layout.test.tsx
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/font/google", () => ({
  Plus_Jakarta_Sans: () => ({ variable: "jakarta-var" }),
}));
vi.mock("./globals.css", () => ({}));

import RootLayout, { metadata } from "./layout";

describe("Root layout", () => {
  it("sets the product metadata", () => {
    expect(metadata.title).toBe("Vectroq");
    expect(String(metadata.metadataBase)).toBe("https://vectroq.vercel.app/");
    expect(metadata.description).toMatch(/priced Bill of Quantities/);
  });

  it("renders an English document with the font variable and the children", () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <p>hello</p>
      </RootLayout>,
    );
    expect(html).toContain('<html lang="en"');
    expect(html).toContain("jakarta-var");
    expect(html).toContain("<p>hello</p>");
  });

  it("ships the theme script, limited to the pages that allow dark mode", () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <span />
      </RootLayout>,
    );
    expect(html).toContain("vq_theme");
    for (const route of [
      "/demo",
      "/login",
      "/signup",
      "/office",
      "/c",
      "/client",
    ])
      expect(html).toContain(`"${route}"`);
    expect(html).not.toContain('"/api"');
  });
});
