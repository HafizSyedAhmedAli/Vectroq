import { NextRequest, NextResponse } from "next/server";
import { ORG_COOKIE } from "@/lib/org";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const slug = new URL(req.url).searchParams.get("slug") ?? "demo";
  const res = NextResponse.redirect(new URL("/office", req.url));
  res.cookies.set(ORG_COOKIE, slug, { path: "/" });
  return res;
}
