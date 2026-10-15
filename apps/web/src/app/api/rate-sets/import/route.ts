// apps/web/src/app/api/rate-sets/import/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { Category } from "@tmcc/shared-types";
import { importCsr } from "@/lib/import-csr";

export const maxDuration = 60;

// Body: { csv, document, year, categories: ["A","B","C"], approvedBy }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const approvedBy =
    typeof body?.approvedBy === "string" ? body.approvedBy.trim() : "";
  const document =
    typeof body?.document === "string" ? body.document.trim() : "";
  const year = Number(body?.year);
  const categories = (
    Array.isArray(body?.categories) ? body.categories : []
  ).filter((c: unknown): c is Category => ["A", "B", "C"].includes(String(c)));

  if (!approvedBy || !document || !categories.length) {
    return NextResponse.json(
      { error: "approvedBy, document and categories (A/B/C) are required" },
      { status: 400 },
    );
  }
  if (approvedBy.length > 100 || document.length > 100) {
    return NextResponse.json(
      { error: "approvedBy and document must be 100 characters or fewer" },
      { status: 400 },
    );
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json(
      { error: "year must be a whole number between 2000 and 2100" },
      { status: 400 },
    );
  }
  if (typeof body?.csv !== "string") {
    return NextResponse.json(
      { error: "csv text is required" },
      { status: 400 },
    );
  }

  const result = await importCsr({
    csv: body.csv,
    document,
    year,
    categories,
    approvedBy,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(
    { imported: result.imported, cities: result.cities },
    { status: 201 },
  );
}
