import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Next 16 renamed the "middleware" convention to "proxy".
//
// Optimistic, cookie-only auth gate: visitors with no session cookie are sent to
// /login. We deliberately do NOT bounce cookie-bearing visitors away from
// /login — the cookie's mere presence isn't proof of a valid session (it can be
// stale/expired), and pairing that with the layout's authoritative check caused
// an infinite /login <-> / redirect loop. /login must always be reachable so the
// authoritative server-side check in the workspace layout can take over.
export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/login";

  if (!sessionCookie && !isLogin) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") {
      url.searchParams.set("redirect", pathname);
    }
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except the auth API, Next internals, and static assets.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
