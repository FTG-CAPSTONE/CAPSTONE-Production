import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Public paths that do NOT require authentication */
const PUBLIC = ["/login", "/favicon.ico"];

/** Dashboard paths that DO require authentication */
const DASHBOARD_MATCHER = /^\/(dashboard|cases|hitl|investigations|ml-admin|analytics|quality|audit|settings|help|admin|risk-register|unauthorized)/;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let public paths and Next.js internals through
  if (
    PUBLIC.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api")
  ) {
    return NextResponse.next();
  }

  // For dashboard routes, check for a session token
  if (DASHBOARD_MATCHER.test(pathname)) {
    // Token is stored in sessionStorage (client-side only) — we can't read it
    // in proxy (edge runtime). We use a lightweight cookie set on login instead.
    // If the cookie is absent, redirect to login.
    const token = request.cookies.get("cg_session")?.value;
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - public assets (*.png, *.jpg, *.svg, *.ico)
     */
    "/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)",
  ],
};
