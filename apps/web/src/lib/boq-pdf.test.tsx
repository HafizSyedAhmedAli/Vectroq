// apps/web/src/lib/boq-pdf.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement, ReactNode } from "react";
import type { BOQResult } from "@vectroq/shared-types";
import type { BoqPdfData } from "./boq-pdf";

const captured: { el: ReactElement | null } = { el: null };

vi.mock("@react-pdf/renderer", () => {
  const box =
    (tag: string) =>
    ({ children, title, author, src, render }: Record<string, unknown>) => {
      const content =
        typeof render === "function"
          ? (render as (a: { pageNumber: number; totalPages: number }) => string)(
              { pageNumber: 1, totalPages: 2 },
            )
          : (children as ReactNode);
      return (
        <div data-tag={tag} data-title={title as string} data-author={author as string} data-src={src ? "img" : undefined}>
          {content}
        </div>
      );
    };
  return {
    Document: box("document"),
    Page: box("page"),
    View: box("view"),
    Text: box("text"),
    Image: box("image"),
    StyleSheet: { create: <T,>(s: T) => s },
    renderToBuffer: vi.fn(async (el: ReactElement) => {
      captured.el = el;
      return Buffer.from("%PDF-fake");
    }),
  };
});

import { renderBoqPdf } from "./boq-pdf";
import { renderToBuffer } from "@react-pdf/renderer";

const boq: BOQResult = {
  lineItems: [
    { itemType: "foundation", quantity: 1200, unit: "sqft", unitRate: 450.4, subtotal: 540480 },
    { itemType: "masonry", quantity: 900, unit: "sqft", unitRate: 120, subtotal: 108000 },
    { itemType: "cement", quantity: 300, unit: "bag", unitRate: 1300, subtotal: 390000 },
  ],
  subtotal: 1038480,
  tax: 103848,
  total: 1142328,
};

function data(over: Partial<BoqPdfData> = {}): BoqPdfData {
  return {
    brand: {
      name: "TM Construction",
      tagline: "",
      description: "",
      logoUrl: null,
      colors: { primary: "#123456" },
      contact: { phone: "0300-1", email: "a@b.com" },
      offices: [{ title: "Head Office", address: "Hyderabad" }],
    },
    boq,
    logo: null,
    clientName: "Ahmed Raza",
    contact: "0300-9",
    city: "Hyderabad",
    category: "B",
    engagement: "Full construction",
    areaSqFt: 1800,
    dateLabel: "25 Oct 2026",
    assumptions: ["Assumption one"],
    exclusions: ["Boundary wall"],
    platformBranding: false,
    ...over,
  };
}

async function html(over: Partial<BoqPdfData> = {}) {
  await renderBoqPdf(data(over));
  return renderToStaticMarkup(captured.el!);
}

beforeEach(() => {
  captured.el = null;
  vi.mocked(renderToBuffer).mockClear();
});

describe("renderBoqPdf", () => {
  it("returns the buffer from renderToBuffer", async () => {
    const buf = await renderBoqPdf(data());
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.toString()).toBe("%PDF-fake");
    expect(renderToBuffer).toHaveBeenCalledTimes(1);
  });

  it("renders title, client details, groups and totals", async () => {
    const out = await html();
    expect(out).toContain("Bill of Quantities &amp; Cost Estimate");
    expect(out).toContain("Prepared on 25 Oct 2026");
    expect(out).toContain("Ahmed Raza");
    expect(out).toContain("Category B");
    expect(out).toContain("Structure");
    expect(out).toContain("Masonry &amp; Plaster");
    expect(out).toContain("Materials");
    expect(out).not.toContain("Finishes subtotal");
    expect(out).toContain("Foundation, excavation &amp; plinth");
    expect(out).toContain("Rs 1,038,480");
    expect(out).toContain("Sales tax (10%)");
    expect(out).toContain("Rs 1,142,328");
    expect(out).toContain("Approx. Rs 635 per sq ft");
  });

  it("sets document title and author", async () => {
    const out = await html();
    expect(out).toContain('data-title="BOQ - Ahmed Raza"');
    expect(out).toContain('data-author="TM Construction"');
  });

  it("shows brand name when there is no logo, and an image when there is", async () => {
    const noLogo = await html();
    expect(noLogo).not.toContain('data-tag="image"');
    expect(noLogo).toContain("TM Construction");
    const withLogo = await html({ logo: Buffer.from("png") });
    expect(withLogo).toContain('data-tag="image"');
  });

  it("lists offices and joins phone and email", async () => {
    const out = await html();
    expect(out).toContain("Head Office");
    expect(out).toContain("0300-1 | a@b.com");
  });

  it("drops missing contact parts", async () => {
    const out = await html({
      brand: { ...data().brand, contact: { email: "only@x.com" } },
    });
    expect(out).toContain("only@x.com");
    expect(out).not.toContain(" | only@x.com");
  });

  it("adds the Vectroq footer only on the free plan", async () => {
    expect(await html({ platformBranding: true })).toContain("Prepared with Vectroq");
    expect(await html({ platformBranding: false })).not.toContain("Prepared with Vectroq");
  });

  it("renders the page number footer", async () => {
    expect(await html()).toContain("Page 1 of 2");
  });

  it("prints the rate basis line when present", async () => {
    const out = await html({
      boq: {
        ...boq,
        rateBasis: {
          label: "Sindh CSR 2026",
          place: "Karachi",
          requestedCity: "Hyderabad",
          isFallback: true,
          origin: "csr",
        },
      },
    });
    expect(out).toContain("Sindh CSR 2026, using Karachi rates");
  });

  it("omits the rate basis line when absent", async () => {
    expect(await html()).not.toContain("Rates:");
  });

  it("renders assumptions and exclusions", async () => {
    const out = await html();
    expect(out).toContain("- Assumption one");
    expect(out).toContain("- Boundary wall");
    expect(out).toContain("Client acceptance");
  });

  it("falls back to the raw item type for unknown items", async () => {
    const out = await html({
      boq: {
        ...boq,
        lineItems: [
          { itemType: "mystery" as never, quantity: 1, unit: "zz", unitRate: 1, subtotal: 1 },
        ],
      },
    });
    expect(out).toContain("mystery");
  });

  it("handles zero area without dividing by zero", async () => {
    const out = await html({ areaSqFt: 0 });
    expect(out).toContain("per sq ft");
    expect(out).not.toContain("Infinity");
  });
});
