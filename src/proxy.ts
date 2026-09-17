import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, decryptSession } from "@/lib/session";

/**
 * Next.js 16 renamed Middleware to Proxy. Same behaviour, new filename.
 *
 * This is an OPTIMISTIC check only. It reads the signed cookie to keep
 * logged-out visitors out of the dashboards and to bounce logged-in users off
 * the login page, and it deliberately does no database work, because Proxy
 * runs on every request including prefetches.
 *
 * Real authorisation lives in the data access layer (src/lib/auth.ts), which
 * every page and every server action goes through. Nothing here is load
 * bearing for security.
 */

const PROTECTED_PREFIXES = ["/superadmin", "/group", "/member"];

function homePathFor(role: string): string {
  if (role === "SUPER_ADMIN") return "/superadmin";
  if (role === "GROUP_ADMIN") return "/group";
  return "/member";
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const session = await decryptSession(request.cookies.get(SESSION_COOKIE)?.value);
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtected && !session) {
    const loginUrl = new URL("/login", request.nextUrl);
    // Remember where they were headed so login can send them back.
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL(homePathFor(session.role), request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next internals, the manifest, and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.\\w+$).*)"],
};
