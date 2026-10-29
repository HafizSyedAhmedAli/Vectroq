// apps/web/src/lib/project-pdf-no-org.test.ts
import { describe, it, expect, vi } from "vitest";

const renderBoqPdf = vi.fn();
vi.mock("@/lib/boq-pdf", () => ({
  renderBoqPdf: (a: unknown) => renderBoqPdf(a),
}));

import { projectPdfResponse, type ProjectForPdf } from "./project-pdf";

describe("projectPdfResponse without a company", () => {
  it("returns a clean 500 instead of throwing", async () => {
    const res = await projectPdfResponse({
      city: "Karachi",
      category: "B",
      model: 2,
      lead: { name: "Ali", contact: "1" },
      cadFile: { boq: { total: 1 }, geometry: { rooms: [] } },
      organization: null,
    } as unknown as ProjectForPdf);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/no company/i);
    expect(renderBoqPdf).not.toHaveBeenCalled();
  });
});
