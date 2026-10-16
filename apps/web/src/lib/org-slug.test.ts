import { describe, it, expect } from "vitest";
import { slugify, validateSlug } from "./org-slug";

describe("slugify", () => {
  it("makes a clean slug", () => {
    expect(slugify("  Acme Builders & Co.  ")).toBe("acme-builders-co");
    expect(slugify("Café Ünïcode")).toBe("cafe-unicode");
  });
});

describe("validateSlug", () => {
  it("accepts good slugs", () =>
    expect(validateSlug("acme-builders")).toBeNull());
  it.each(["ab", "-acme", "acme-", "Acme", "a--b", "office", "has space"])(
    "rejects %s",
    (s) => expect(validateSlug(s)).not.toBeNull(),
  );
});
