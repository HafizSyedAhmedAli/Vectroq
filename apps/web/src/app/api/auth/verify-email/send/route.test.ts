// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/auth/guard", () => ({ guard: vi.fn() }));
vi.mock("@/lib/auth/email-verification", () => ({ sendVerificationEmail: vi.fn() }));
vi.mock("@/lib/app-url", () => ({ appUrl: () => "https://app.test" }));

import { POST } from "./route";
import { guard } from "@/lib/auth/guard";
import { sendVerificationEmail } from "@/lib/auth/email-verification";

const req = () => new Request("http://localhost/api/auth/verify-email/send", { method: "POST" }) as any;
const as = (emailVerified: boolean) =>
  (guard as any).mockResolvedValue({
    ok: true,
    auth: { user: { id: "u1", email: "a@b.co", emailVerified } },
  });

describe("POST /api/auth/verify-email/send", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the guard response when signed out", async () => {
    (guard as any).mockResolvedValue({
      ok: false,
      res: NextResponse.json({ error: "Sign in required." }, { status: 401 }),
    });
    expect((await POST(req())).status).toBe(401);
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("short-circuits when already verified", async () => {
    as(true);
    const json = await (await POST(req())).json();
    expect(json).toEqual({ ok: true, alreadyVerified: true });
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("sends the email", async () => {
    as(false);
    (sendVerificationEmail as any).mockResolvedValue("sent");
    const json = await (await POST(req())).json();
    expect(json).toEqual({ ok: true, emailed: true });
  });

  it("reports emailed:false when nothing was sent", async () => {
    as(false);
    (sendVerificationEmail as any).mockResolvedValue("skipped");
    expect((await (await POST(req())).json()).emailed).toBe(false);
  });

  it("429s during the cooldown", async () => {
    as(false);
    (sendVerificationEmail as any).mockResolvedValue("cooldown");
    expect((await POST(req())).status).toBe(429);
  });

  it("502s when sending throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    as(false);
    (sendVerificationEmail as any).mockRejectedValue(new Error("smtp"));
    expect((await POST(req())).status).toBe(502);
    spy.mockRestore();
  });
});
