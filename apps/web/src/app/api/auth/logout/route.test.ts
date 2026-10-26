// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ destroySession: vi.fn() }));

import { POST } from "./route";
import { destroySession } from "@/lib/auth/session";

describe("POST /api/auth/logout", () => {
  it("destroys the session and returns ok", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(destroySession).toHaveBeenCalledTimes(1);
  });
});
