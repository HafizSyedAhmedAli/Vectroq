// apps/web/src/app/api/leads/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BUDGET_RANGES, TIMELINES } from "@vectroq/lead-intake";
import { POST } from "./route";

vi.mock("@vectroq/db", () => ({
  prisma: { lead: { create: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/auth/guard", () => ({
  guard: vi.fn().mockResolvedValue({
    ok: true,
    auth: {
      org: { id: "org_1", slug: "demo" },
      role: "OWNER",
      user: { id: "u1", email: "t@t.co", name: "Test" },
    },
  }),
}));
vi.mock("@/lib/org", () => ({
  getOrgBySlug: vi.fn().mockResolvedValue({ id: "org_1", slug: "demo" }),
}));
vi.mock("@/lib/rate-sets", () => ({
  getLiveRateCard: vi.fn().mockRejectedValue(new Error("no rates")),
}));
vi.mock("@/lib/save-plan-file", () => ({ savePlanFile: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi
    .fn()
    .mockResolvedValue({ ok: true, remaining: 5, retryAfterSec: 0 }),
  tooMany: vi.fn(() => Response.json({ error: "Too many" }, { status: 429 })),
  clientIp: vi.fn(() => "1.2.3.4"),
}));

vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));

import { getOrgBySlug } from "@/lib/org";
import { guard } from "@/lib/auth/guard";
import { prisma } from "@vectroq/db";
import { savePlanFile } from "@/lib/save-plan-file";
import { rateLimit } from "@/lib/rate-limit";

const validBody = {
  name: "Ahmed Raza",
  contact: "+92-300-1234567",
  city: "Hyderabad",
  model: 2,
  category: "B",
  houseType: "Villa",
  floors: 2,
  bedrooms: 3,
  plotSizeSqYd: 240,
  coveredAreaSqFt: 1800,
  budgetRange: BUDGET_RANGES[2],
  timeline: TIMELINES[1],
  consent: true,
};

const BOT = { website: "", elapsedMs: 10_000 };

function jsonReq(body: unknown) {
  return new Request("http://localhost/api/leads", {
    method: "POST",
    body: JSON.stringify({ orgSlug: "demo", bot: BOT, ...(body as object) }),
  });
}

function multipartReq(body: unknown, file: File) {
  const form = new FormData();
  form.append(
    "data",
    JSON.stringify({ orgSlug: "demo", bot: BOT, ...(body as object) }),
  );
  form.append("file", file);
  return new Request("http://localhost/api/leads", {
    method: "POST",
    body: form,
  });
}

describe("POST /api/leads", () => {
  beforeEach(() => vi.clearAllMocks());

  it("persists a valid lead via prisma and returns 201", async () => {
    (prisma.lead.create as any).mockResolvedValue({
      id: "lead_1",
      ...validBody,
      organizationId: "org_1",
      additionalNotes: null,
      source: "FORM",
      createdAt: new Date(),
    });

    const res = await POST(jsonReq(validBody) as any);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.id).toBe("lead_1");
    expect(prisma.lead.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ...validBody,
        additionalNotes: null,
        source: "FORM",
      }),
    });
    expect(savePlanFile).not.toHaveBeenCalled();
  });

  it("only writes whitelisted fields to the database", async () => {
    (prisma.lead.create as any).mockResolvedValue({ id: "lead_1" });

    await POST(
      jsonReq({
        ...validBody,
        id: "hacked",
        source: "WHATSAPP",
        organizationId: "org_evil",
      }) as any,
    );
    const data = (prisma.lead.create as any).mock.calls[0][0].data;
    expect(data.id).toBeUndefined();
    expect(data.source).toBe("FORM");
    expect(data.organizationId).toBe("org_1");
  });

  it("returns 400 and does not touch the DB when validation fails", async () => {
    const res = await POST(jsonReq({ ...validBody, city: "" }) as any);
    expect(res.status).toBe(400);
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  it("returns 400 when the new required fields are missing", async () => {
    const { floors, consent, ...old } = validBody;
    const res = await POST(jsonReq(old) as any);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.errors.floors).toBeDefined();
    expect(json.errors.consent).toBeDefined();
  });

  it("returns 400 (not a 500) for an unparseable body", async () => {
    const res = await POST(
      new Request("http://localhost/api/leads", {
        method: "POST",
        body: "{nope",
      }) as any,
    );
    expect(res.status).toBe(400);
  });

  it("accepts multipart with a plot plan, saves it and links it to the lead", async () => {
    (prisma.lead.create as any).mockResolvedValue({ id: "lead_1" });
    (savePlanFile as any).mockResolvedValue("/lead-plans/lead_1.pdf");
    (prisma.lead.update as any).mockResolvedValue({
      id: "lead_1",
      planFileUrl: "/lead-plans/lead_1.pdf",
    });

    const file = new File(["%PDF"], "plan.pdf", { type: "application/pdf" });
    const res = await POST(multipartReq(validBody, file) as any);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(savePlanFile).toHaveBeenCalledWith("lead_1", expect.any(File));
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: "lead_1" },
      data: { planFileUrl: "/lead-plans/lead_1.pdf", planFileName: "plan.pdf" },
    });
    expect(json.planFileUrl).toBe("/lead-plans/lead_1.pdf");
  });

  it("rejects an unsupported plan file before creating the lead", async () => {
    const file = new File(["x"], "malware.exe");
    const res = await POST(multipartReq(validBody, file) as any);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.errors.planFile).toMatch(/unsupported/i);
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  it("still returns 201 when saving the plan file fails (the lead is not lost)", async () => {
    (prisma.lead.create as any).mockResolvedValue({ id: "lead_1" });
    (savePlanFile as any).mockRejectedValue(new Error("disk full"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const file = new File(["%PDF"], "plan.pdf");
    const res = await POST(multipartReq(validBody, file) as any);

    expect(res.status).toBe(201);
    expect(prisma.lead.update).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("404s for an unknown company and creates nothing", async () => {
    (getOrgBySlug as any).mockResolvedValueOnce(null);
    const res = await POST(jsonReq(validBody) as any);
    expect(res.status).toBe(404);
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  it("400s when no company is given", async () => {
    const res = await POST(
      new Request("http://localhost/api/leads", {
        method: "POST",
        body: JSON.stringify(validBody), // no orgSlug
      }) as any,
    );
    expect(res.status).toBe(400);
  });

  it("429s when the IP is rate limited and does no work", async () => {
    (rateLimit as any).mockResolvedValueOnce({
      ok: false,
      remaining: 0,
      retryAfterSec: 60,
    });
    const res = await POST(jsonReq(validBody) as any);
    expect(res.status).toBe(429);
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  it("silently drops a filled honeypot (looks like success, saves nothing)", async () => {
    const res = await POST(
      new Request("http://localhost/api/leads", {
        method: "POST",
        body: JSON.stringify({
          orgSlug: "demo",
          ...validBody,
          bot: { website: "spam", elapsedMs: 10_000 },
        }),
      }) as any,
    );
    expect(res.status).toBe(201);
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  it("rejects a form submitted impossibly fast", async () => {
    const res = await POST(
      new Request("http://localhost/api/leads", {
        method: "POST",
        body: JSON.stringify({
          orgSlug: "demo",
          ...validBody,
          bot: { website: "", elapsedMs: 200 },
        }),
      }) as any,
    );
    expect(res.status).toBe(400);
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  it("rejects a plan file whose contents don't match its extension", async () => {
    const fake = new File(["MZ not a pdf"], "plan.pdf", {
      type: "application/pdf",
    });
    const res = await POST(multipartReq(validBody, fake) as any);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.errors.planFile).toMatch(/don't match/i);
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });
});
