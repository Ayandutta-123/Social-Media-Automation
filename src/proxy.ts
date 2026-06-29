import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // Check if the user has a valid session cookie
  const session = request.cookies.get("session")?.value;

  // The path the user is trying to access
  const path = request.nextUrl.pathname;

  // If the user is on the login page and ALREADY has a session, redirect to dashboard
  if (path === "/login" && session === "authenticated") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // If the user is NOT on the login page and does NOT have a session, redirect to login
  if (path !== "/login" && session !== "authenticated") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Allow the request to proceed
  return NextResponse.next();
}

// Protect all routes EXCEPT static files, next.js internals, and images
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico|logo.png).*)",
  ],
};
