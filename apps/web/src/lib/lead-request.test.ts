// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  BUDGET_RANGES,
  TIMELINES,
  type LeadIntakeInput,
} from "@vectroq/lead-intake";
import { pickLeadData, readLeadRequest } from "./lead-request";

const jsonReq = (b: unknown) =>
  new Request("http://x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof b === "string" ? b : JSON.stringify(b),
  });
const multipart = (data: string | null, file?: File | string) => {
  const f = new FormData();
  if (data !== null) f.append("data", data);
  if (file !== undefined) f.append("file", file);
  return new Request("http://x", { method: "POST", body: f });
};

describe("readLeadRequest", () => {
  it("reads a JSON body with no file", async () => {
    expect(await readLeadRequest(jsonReq({ a: 1 }))).toEqual({
      body: { a: 1 },
      planFile: null,
    });
  });

  it("returns a null body for unparseable JSON", async () => {
    expect((await readLeadRequest(jsonReq("{nope"))).body).toBeNull();
  });

  it("reads multipart data and the plan file", async () => {
    const file = new File(["%PDF"], "plan.pdf");
    const r = await readLeadRequest(multipart(JSON.stringify({ a: 1 }), file));
    expect(r.body).toEqual({ a: 1 });
    expect(r.planFile).toBeInstanceOf(File);
    expect(r.planFile!.name).toBe("plan.pdf");
  });

  it("returns a null body when the data field is bad or missing", async () => {
    expect((await readLeadRequest(multipart("{nope"))).body).toBeNull();
    expect((await readLeadRequest(multipart(null))).body).toBeNull();
  });

  it("ignores an empty file and a non-file 'file' field", async () => {
    expect(
      (await readLeadRequest(multipart("{}", new File([], "empty.pdf"))))
        .planFile,
    ).toBeNull();
    expect(
      (await readLeadRequest(multipart("{}", "just text"))).planFile,
    ).toBeNull();
  });
});

const valid: LeadIntakeInput = {
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

describe("pickLeadData", () => {
  it("returns exactly the whitelisted fields", () => {
    expect(pickLeadData(valid, "org_1")).toEqual({
      organizationId: "org_1",
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
      additionalNotes: null,
      consent: true,
      source: "FORM",
    });
  });

  it("trims text and turns blank notes into null", () => {
    const r = pickLeadData(
      { ...valid, name: "  Ali ", contact: " 03 ", additionalNotes: "  hi " },
      "o",
    );
    expect(r).toMatchObject({
      name: "Ali",
      contact: "03",
      additionalNotes: "hi",
    });
    expect(
      pickLeadData({ ...valid, additionalNotes: "   " }, "o").additionalNotes,
    ).toBeNull();
  });

  it("never lets the client set id, source or organization", () => {
    const evil = {
      ...valid,
      id: "x",
      source: "WHATSAPP",
      organizationId: "org_evil",
    } as never;
    const r = pickLeadData(evil, "org_1") as Record<string, unknown>;
    expect(r.id).toBeUndefined();
    expect(r.source).toBe("FORM");
    expect(r.organizationId).toBe("org_1");
  });
});
