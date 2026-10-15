import { NextRequest, NextResponse } from "next/server";
import { validateRateItems } from "@tmcc/rate-cards";
import { approveRateSet, RateSetError } from "@/lib/rate-sets";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const approvedBy =
    typeof body?.approvedBy === "string" ? body.approvedBy.trim() : "";
  if (!approvedBy) {
    return NextResponse.json(
      { error: "approvedBy is required" },
      { status: 400 },
    );
  }

  let items;
  if (body?.items !== undefined) {
    const v = validateRateItems(body.items);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    items = v.items;
  }

  try {
    return NextResponse.json(await approveRateSet(id, approvedBy, items));
  } catch (err) {
    if (err instanceof RateSetError) {
      return err.code === "NOT_FOUND"
        ? NextResponse.json({ error: "Rate set not found" }, { status: 404 })
        : NextResponse.json(
            { error: "Only DRAFT rate sets can be approved" },
            { status: 409 },
          );
    }
    throw err;
  }
}
