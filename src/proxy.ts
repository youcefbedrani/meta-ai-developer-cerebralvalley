import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gate for the dashboard: no session cookie → redirect to /login.
 * This only checks that the cookie exists. Real verification happens on the
 * server in getCurrentUser() for every page, server action and route handler.
 */
export const SESSION_COOKIE = "__session";

export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/onboarding/:path*"],
};
