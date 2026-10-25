import { describe, it, expect } from "vitest";
import { buildLeadRequest } from "./build-lead-request";

const data = { name: "Ali" } as never;

describe("buildLeadRequest", () => {
  it("sends JSON when there is no plan file", () => {
    const req = buildLeadRequest(data, null, "acme");
    expect(req.method).toBe("POST");
    expect(req.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(req.body as string)).toEqual({ name: "Ali", orgSlug: "acme" });
  });

  it("includes bot payload in JSON", () => {
    const bot = { website: "", elapsedMs: 5000, turnstileToken: "t" };
    const req = buildLeadRequest(data, null, "acme", bot);
    expect(JSON.parse(req.body as string).bot).toEqual(bot);
  });

  it("sends multipart FormData with a file and no manual content-type", () => {
    const file = new File(["x"], "plan.dxf");
    const req = buildLeadRequest(data, file, "acme");
    expect(req.method).toBe("POST");
    expect(req.headers).toBeUndefined();
    const form = req.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(JSON.parse(form.get("data") as string).orgSlug).toBe("acme");
    expect((form.get("file") as File).name).toBe("plan.dxf");
  });
});
