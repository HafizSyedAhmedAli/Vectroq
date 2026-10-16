import { NextRequest, NextResponse } from "next/server";
import { Prisma, prisma } from "@vectroq/db";
import { DEFAULT_ORG_SLUG, ORG_COOKIE } from "@/lib/org";
import { slugify, validateSlug } from "@/lib/org-slug";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const slug = slugify(typeof body?.slug === "string" ? body.slug : name);

  if (!name || name.length > 100)
    return NextResponse.json(
      { error: "Company name is required (max 100 characters)." },
      { status: 400 },
    );
  const slugError = validateSlug(slug);
  if (slugError)
    return NextResponse.json({ error: slugError }, { status: 400 });

  // Sample rates from the demo org, so the new company can price a BOQ at once.
  const demo = await prisma.organization.findUnique({
    where: { slug: DEFAULT_ORG_SLUG },
  });
  const sampleRates = demo
    ? await prisma.rateSet.findMany({
        where: { organizationId: demo.id, status: "APPROVED" },
      })
    : [];

  let org;
  try {
    org = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({ data: { slug, name } });
      if (sampleRates.length) {
        await tx.rateSet.createMany({
          data: sampleRates.map((r) => ({
            organizationId: created.id,
            city: r.city,
            category: r.category,
            status: "APPROVED",
            origin: r.origin,
            taxPercent: r.taxPercent,
            items: r.items as Prisma.InputJsonValue,
            sources: r.sources ?? Prisma.JsonNull,
            approvedAt: r.approvedAt,
            approvedBy: r.approvedBy,
          })),
        });
      }
      return created;
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    )
      return NextResponse.json(
        { error: "That address is already taken." },
        { status: 409 },
      );
    throw err;
  }

  const res = NextResponse.json({ slug: org.slug }, { status: 201 });
  // TEMPORARY: auth replaces this cookie with a real session.
  res.cookies.set(ORG_COOKIE, org.slug, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
