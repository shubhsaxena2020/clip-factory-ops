import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

// Everything is behind the dashboard login except the login page/handler and the ingest endpoint
// (which has its own bearer-token auth).
export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|api/login|api/ingest|_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};
