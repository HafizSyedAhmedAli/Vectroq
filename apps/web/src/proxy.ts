import { NextResponse, type NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  if (req.cookies.has("vq_session")) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const url = new URL("/login", req.url);
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/office/:path*",
    "/api/projects/:path*",
    "/api/rate-sets/:path*",
    "/api/org/:path*",
    "/api/team/:path*",
    "/api/leads/:id/plan",
  ],
};
