export interface OrgSettingsInput {
  name: string;
  tagline: string | null;
  primaryColor: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  offices: { title: string; address: string }[];
}

export type OrgSettingsResult =
  | { ok: true; data: OrgSettingsInput }
  | { ok: false; error: string };

const opt = (v: unknown, max: number): string | null | undefined => {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string" || v.trim().length > max) return undefined;
  return v.trim();
};

export function validateOrgSettings(input: unknown): OrgSettingsResult {
  const b = (input ?? {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name || name.length > 100)
    return {
      ok: false,
      error: "Company name is required (max 100 characters).",
    };
  if (
    typeof b.primaryColor !== "string" ||
    !/^#[0-9a-fA-F]{6}$/.test(b.primaryColor)
  )
    return { ok: false, error: "Brand color must look like #2563EB." };

  const tagline = opt(b.tagline, 120);
  const phone = opt(b.phone, 40);
  const email = opt(b.email, 100);
  const website = opt(b.website, 100);
  if ([tagline, phone, email, website].includes(undefined))
    return { ok: false, error: "One of the contact fields is too long." };

  const rawOffices = Array.isArray(b.offices) ? b.offices : [];
  if (rawOffices.length > 5) return { ok: false, error: "At most 5 offices." };
  const offices: { title: string; address: string }[] = [];
  for (const o of rawOffices) {
    const title = typeof o?.title === "string" ? o.title.trim() : "";
    const address = typeof o?.address === "string" ? o.address.trim() : "";
    if (!title && !address) continue;
    if (!title || !address || title.length > 60 || address.length > 200)
      return { ok: false, error: "Each office needs a title and an address." };
    offices.push({ title, address });
  }

  return {
    ok: true,
    data: {
      name,
      tagline: tagline ?? null,
      primaryColor: b.primaryColor,
      phone: phone ?? null,
      email: email ?? null,
      website: website ?? null,
      offices,
    },
  };
}
