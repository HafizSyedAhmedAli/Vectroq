import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: (u: string) => {
    throw new Error(`REDIRECT:${u}`);
  },
}));
vi.mock("@/lib/org", () => ({ DEFAULT_ORG_SLUG: "acme-default" }));

import RequestRedirect from "./page";

describe("/request", () => {
  it("redirects to the default company's intake form", () => {
    expect(() => RequestRedirect()).toThrow("REDIRECT:/c/acme-default");
  });
});
