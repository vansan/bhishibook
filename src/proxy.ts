import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, decryptSession } from "@/lib/session";

/**
 * Next.js 16 renamed Middleware to Proxy. Same behaviour, new filename.
 *
 * This is an OPTIMISTIC check only. It reads the signed cookie to keep
 * logged-out visitors out of the dashboards and to send signed-in users to the
 * right place, and it deliberately does no database work, because Proxy runs
 * on every request including prefetches.
 *
 * Real authorisation lives in the data access layer (src/lib/auth.ts), which
 * every page and every server action goes through. Nothing here is load
 * bearing for security.
 */

/** A group is a tenant, so the two audiences have separate front doors. */
const TENANT_LOGIN = "/login";
const PLATFORM_LOGIN = "/superadmin/login";

const PROTECTED_PREFIXES = ["/superadmin", "/group", "/member"];
const PUBLIC_PATHS = new Set([TENANT_LOGIN, PLATFORM_LOGIN, "/", "/denied"]);

function homePathFor(role: string): string {
  if (role === "SUPER_ADMIN") return "/superadmin";
  if (role === "GROUP_ADMIN") return "/group";
  return "/member";
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const session = await decryptSession(request.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.has(pathname);
  const isProtected =
    !isPublic &&
    PROTECTED_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );

  if (isProtected && !session) {
    // Send them to the door that matches where they were headed, so a
    // superadmin deep link does not drop them on the group sign-in.
    const target = pathname.startsWith("/superadmin") ? PLATFORM_LOGIN : TENANT_LOGIN;
    const loginUrl = new URL(target, request.nextUrl);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Someone already signed in has no use for either login page.
  if (session && (pathname === TENANT_LOGIN || pathname === PLATFORM_LOGIN)) {
    return NextResponse.redirect(new URL(homePathFor(session.role), request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next internals, the manifest, and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.\\w+$).*)"],
};
