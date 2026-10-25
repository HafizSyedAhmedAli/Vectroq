import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const renderBoqPdf = vi.fn();
vi.mock("@/lib/boq-pdf", () => ({ renderBoqPdf: (a: unknown) => renderBoqPdf(a) }));

import { projectPdfResponse, type ProjectForPdf } from "./project-pdf";

const geometry = { rooms: [{ area: 100.4 }, { area: 50.4 }] };
const project = (o: Record<string, unknown> = {}, orgO: Record<string, unknown> = {}, leadName = "Ali Khan") =>
  ({
    city: "Karachi", category: "B", model: 2,
    lead: { name: leadName, contact: "0300" },
    cadFile: { boq: { total: 1 }, geometry },
    organization: { name: "Acme", tagline: null, logoUrl: null, primaryColor: "#2563EB", phone: null, email: null, website: null, offices: [], plan: "FREE", rules: null, ...orgO },
    ...o,
  }) as unknown as ProjectForPdf;

beforeEach(() => { renderBoqPdf.mockReset(); renderBoqPdf.mockResolvedValue(Buffer.from("%PDF-test")); });
afterEach(() => vi.unstubAllGlobals());

describe("projectPdfResponse", () => {
  it("404s with a JSON error when no BOQ exists", async () => {
    const res = await projectPdfResponse(project({ cadFile: null }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/No BOQ/);
    const res2 = await projectPdfResponse(project({ cadFile: { boq: null, geometry } }));
    expect(res2.status).toBe(404);
    expect(renderBoqPdf).not.toHaveBeenCalled();
  });

  it("returns a PDF attachment with a safe filename and no-store", async () => {
    const res = await projectPdfResponse(project({}, {}, "  Ali / Khan!! "));
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="BOQ-Ali-Khan.pdf"');
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe("%PDF-test");
  });

  it("falls back to 'project' when the name has no safe characters", async () => {
    const res = await projectPdfResponse(project({}, {}, "!!!"));
    expect(res.headers.get("Content-Disposition")).toContain("BOQ-project.pdf");
  });

  it("passes client data, rounded area and plan-based branding to the renderer", async () => {
    await projectPdfResponse(project());
    const a = renderBoqPdf.mock.calls[0][0];
    expect(a.clientName).toBe("Ali Khan");
    expect(a.contact).toBe("0300");
    expect(a.city).toBe("Karachi");
    expect(a.areaSqFt).toBe(151);
    expect(a.platformBranding).toBe(true);
    expect(a.category).toMatch(/^B \(/);
    expect(a.engagement).toMatch(/^Model 2 - /);
    expect(a.logo).toBeNull();
    expect(Array.isArray(a.assumptions)).toBe(true);
    expect(Array.isArray(a.exclusions)).toBe(true);
    expect(a.brand.name).toBe("Acme");
  });

  it("removes platform branding on paid plans", async () => {
    await projectPdfResponse(project({}, { plan: "PRO" }));
    expect(renderBoqPdf.mock.calls[0][0].platformBranding).toBe(false);
  });

  it("fetches the logo when set", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([1, 2, 3]))));
    await projectPdfResponse(project({}, { logoUrl: "http://logo" }));
    expect(renderBoqPdf.mock.calls[0][0].logo).toEqual(Buffer.from([1, 2, 3]));
  });

  it("uses a null logo when the fetch is not ok or fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 404 })));
    await projectPdfResponse(project({}, { logoUrl: "http://logo" }));
    expect(renderBoqPdf.mock.calls[0][0].logo).toBeNull();
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("net"); }));
    await projectPdfResponse(project({}, { logoUrl: "http://logo" }));
    expect(renderBoqPdf.mock.calls[1][0].logo).toBeNull();
  });
});
