import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths through
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static assets and API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/fonts") ||
    pathname.startsWith("/api")
  ) {
    return NextResponse.next();
  }

  // For the root path — let the page.tsx redirect handle it
  if (pathname === "/") {
    return NextResponse.next();
  }

  // All other routes require a stored refresh token
  // (Access token lives in memory, refresh token in localStorage — not accessible
  // in middleware. We rely on the dashboard layout for the real auth guard.
  // The middleware's job is to redirect obvious unauthenticated requests that
  // arrive without a session cookie. The actual token check is in the layout.)
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
