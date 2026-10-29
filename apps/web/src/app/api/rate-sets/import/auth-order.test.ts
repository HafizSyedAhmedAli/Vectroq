// apps/web/src/app/api/rate-sets/import/auth-order.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/import-csr", () => ({ importCsr: vi.fn() }));
vi.mock("@/lib/org", () => ({ getCurrentOrg: vi.fn() }));
vi.mock("@/lib/auth/guard", () => ({ guard: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
import { importCsr } from "@/lib/import-csr";
import { guard } from "@/lib/auth/guard";

const call = (body: unknown) =>
  POST(
    new Request("http://x", {
      method: "POST",
      body: JSON.stringify(body),
    }) as any,
  );

beforeEach(() => {
  vi.clearAllMocks();
  (guard as any).mockResolvedValue({
    ok: false,
    res: Response.json({ error: "no" }, { status: 403 }),
  });
});

describe("import: authorisation comes before validation", () => {
  it.each([
    {},
    { csv: 5 },
    { approvedBy: "x", document: "d", year: 1999, categories: [], csv: "" },
  ])("a viewer sending %j gets 403, not 400", async (body) => {
    expect((await call(body)).status).toBe(403);
    expect(importCsr).not.toHaveBeenCalled();
  });
});
