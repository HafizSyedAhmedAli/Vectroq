export const RESERVED_SLUGS = new Set([
  "api",
  "office",
  "c",
  "embed",
  "client",
  "request",
  "signup",
  "login",
  "admin",
  "www",
  "app",
  "demo",
  "static",
  "_next",
]);

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

/** Returns an error message, or null when the slug is acceptable. */
export function validateSlug(slug: string): string | null {
  if (!/^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/.test(slug))
    return "Use 3-40 characters: lowercase letters, numbers and hyphens.";
  if (slug.includes("--")) return "No double hyphens.";
  if (RESERVED_SLUGS.has(slug)) return "That address is reserved.";
  return null;
}
