import { NextRequest, NextResponse } from "next/server";
import { validateRateItems } from "@tmcc/rate-cards";
import { prisma } from "@tmcc/db";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const city = typeof body?.city === "string" ? body.city.trim() : "";
  if (!city || !["A", "B", "C"].includes(body?.category)) {
    return NextResponse.json(
      { error: "city and category (A/B/C) are required" },
      { status: 400 },
    );
  }
  const v = validateRateItems(body.items);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const draft = await prisma.rateSet.create({
    data: {
      city,
      category: body.category,
      status: "DRAFT",
      origin: "manual",
      items: v.items as unknown as object,
    },
  });
  
  return NextResponse.json(draft, { status: 201 });
}
