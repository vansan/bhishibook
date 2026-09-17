import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "@prisma/client";

/**
 * Stateless sessions: a signed JWT in an httpOnly cookie, per the pattern in
 * the Next.js authentication guide.
 *
 * The payload carries only what routing and scoping need. Anything sensitive,
 * and anything that must be current, is read from the database in the data
 * access layer instead (see src/lib/auth.ts).
 */

export const SESSION_COOKIE = "bb_session";
const SESSION_DAYS = 7;

export type SessionPayload = {
  userId: string;
  role: UserRole;
  /** Null for a superadmin, who is not scoped to one group. */
  groupId: string | null;
  /** The member row for this user in that group, when they have one. */
  memberId: string | null;
  name: string;
};

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET is missing or too short. Generate one with: openssl rand -base64 32"
    );
  }
  return new TextEncoder().encode(secret);
}

export async function encryptSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

/** Returns null for a missing, tampered, or expired token. Never throws. */
export async function decryptSession(token?: string): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.userId !== "string" || typeof payload.role !== "string") return null;
    return {
      userId: payload.userId,
      role: payload.role as UserRole,
      groupId: (payload.groupId as string | null) ?? null,
      memberId: (payload.memberId as string | null) ?? null,
      name: (payload.name as string) ?? "",
    };
  } catch {
    return null;
  }
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const token = await encryptSession(payload);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // Must not be forced on in development, or the cookie is dropped over
    // plain http on localhost and login silently fails.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function readSessionCookie(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  return decryptSession(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
