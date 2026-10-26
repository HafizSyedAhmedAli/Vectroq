// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/auth/guard", () => ({ guard: vi.fn() }));
vi.mock("@/lib/sample-project", () => ({ createSampleProject: vi.fn() }));
vi.mock("@/lib/app-url", () => ({ appUrl: () => "https://app.test" }));

import { POST } from "./route";
import { guard } from "@/lib/auth/guard";
import { createSampleProject } from "@/lib/sample-project";

const req = () => new Request("http://localhost/api/onboarding/sample-project", { method: "POST" }) as any;

describe("POST /api/onboarding/sample-project", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (guard as any).mockResolvedValue({ ok: true, auth: { org: { id: "o1" } } });
  });

  it("passes through a guard failure", async () => {
    (guard as any).mockResolvedValue({
      ok: false,
      res: NextResponse.json({ error: "no" }, { status: 403 }),
    });
    expect((await POST(req())).status).toBe(403);
    expect(guard).toHaveBeenCalledWith("ESTIMATOR");
    expect(createSampleProject).not.toHaveBeenCalled();
  });

  it("201s with the created project", async () => {
    (createSampleProject as any).mockResolvedValue({ projectId: "p1" });
    const res = await POST(req());
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ projectId: "p1" });
    expect(createSampleProject).toHaveBeenCalledWith({ id: "o1" }, "https://app.test");
  });

  it("500s when creation throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    (createSampleProject as any).mockRejectedValue(new Error("x"));
    expect((await POST(req())).status).toBe(500);
    spy.mockRestore();
  });
});
