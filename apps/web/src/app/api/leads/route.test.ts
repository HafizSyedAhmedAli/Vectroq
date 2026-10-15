// apps/web/src/app/api/leads/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BUDGET_RANGES, TIMELINES } from "@tmcc/lead-intake";
import { POST } from "./route";

vi.mock("@tmcc/db", () => ({
  prisma: { lead: { create: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/save-plan-file", () => ({ savePlanFile: vi.fn() }));

import { prisma } from "@tmcc/db";
import { savePlanFile } from "@/lib/save-plan-file";

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

function jsonReq(body: unknown) {
  return new Request("http://localhost/api/leads", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function multipartReq(body: unknown, file: File) {
  const form = new FormData();
  form.append("data", JSON.stringify(body));
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
      jsonReq({ ...validBody, id: "hacked", source: "WHATSAPP" }) as any,
    );

    const data = (prisma.lead.create as any).mock.calls[0][0].data;
    expect(data.id).toBeUndefined();
    expect(data.source).toBe("FORM");
  });

  it("returns 400 and does not touch the DB when validation fails (FR-4)", async () => {
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
});
