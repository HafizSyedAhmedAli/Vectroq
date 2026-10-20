import { NextRequest, NextResponse } from "next/server";
import { validateRateItems } from "@vectroq/rate-cards";
import { canonicalCityName, CORE_MATERIAL_TYPES } from "@vectroq/shared-types";
import { prisma } from "@vectroq/db";
import { guard } from "@/lib/auth/guard";

export async function POST(req: NextRequest) {
  const g = await guard("ESTIMATOR");
  if (!g.ok) return g.res;
  const org = g.auth.org;

  const body = await req.json().catch(() => null);
  const city = canonicalCityName(
    typeof body?.city === "string" ? body.city : "",
  );
  if (!city) {
    return NextResponse.json(
      { error: "Choose a city from the list." },
      { status: 400 },
    );
  }
  if (!["A", "B", "C"].includes(body?.category)) {
    return NextResponse.json(
      { error: "category (A/B/C) is required" },
      { status: 400 },
    );
  }
  const v = validateRateItems(body.items);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const have = new Set(v.items.map((i) => i.itemType));
  const missing = CORE_MATERIAL_TYPES.filter((t) => !have.has(t));
  if (missing.length) {
    return NextResponse.json(
      { error: `Rates for ${missing.join(", ")} are required.` },
      { status: 400 },
    );
  }

  const draft = await prisma.rateSet.create({
    data: {
      organizationId: org.id,
      city,
      category: body.category,
      status: "DRAFT",
      origin: "manual",
      items: v.items as unknown as object,
    },
  });
  return NextResponse.json(draft, { status: 201 });
}
