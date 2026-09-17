"use server";

import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { homePathFor, SELECTED_GROUP_COOKIE } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession, readSessionCookie } from "@/lib/session";
import { cookies } from "next/headers";

export type LoginState = { error?: string };

/**
 * BhishiBook has two front doors, because a group is a tenant:
 *
 *   /login             group admins and members of a group
 *   /superadmin/login  BhishiBook platform staff
 *
 * Keeping them apart means a group's members never see the platform sign-in,
 * and a superadmin credential is not accepted on a tenant page. Both doors run
 * the same verification; only the audience check differs.
 */
type Audience = "TENANT" | "PLATFORM";

const AUDIENCE_ROLES: Record<Audience, UserRole[]> = {
  TENANT: ["GROUP_ADMIN", "MEMBER"],
  PLATFORM: ["SUPER_ADMIN"],
};

/**
 * A small in-process brake on password guessing.
 *
 * This is not a substitute for a real rate limiter: it is per process, so it
 * resets on redeploy and does not span instances. It is here because it costs
 * nothing and blunts the obvious attack; swap it for a shared store if
 * BhishiBook ever runs on more than one node.
 */
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; firstAt: number }>();

function tooManyAttempts(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(key: string): void {
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: Date.now() });
    return;
  }
  entry.count += 1;
}

/** Same message for a bad email and a bad password, so the form cannot be used to discover who has an account. */
const BAD_CREDENTIALS = "Email or password is incorrect";

async function signIn(formData: FormData, audience: Audience): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!email || !password) {
    return { error: "Enter both your email and password" };
  }
  if (tooManyAttempts(email)) {
    return { error: "Too many attempts. Please wait a few minutes and try again." };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      role: true,
      isActive: true,
      passwordHash: true,
      memberships: {
        where: { status: { not: "INACTIVE" } },
        select: { id: true, groupId: true, group: { select: { status: true, name: true } } },
        orderBy: { joinedAt: "asc" },
        take: 1,
      },
    },
  });

  const passwordOk = await verifyPassword(password, user?.passwordHash);
  if (!user || !user.isActive || !passwordOk) {
    recordFailure(email);
    return { error: BAD_CREDENTIALS };
  }

  // The credentials are right, so pointing them at the correct door is
  // helpful rather than a disclosure: they already proved who they are.
  if (!AUDIENCE_ROLES[audience].includes(user.role)) {
    return {
      error:
        audience === "TENANT"
          ? "This is the group sign-in. Platform administrators sign in at /superadmin/login."
          : "This sign-in is for BhishiBook platform staff. Group members sign in at /login.",
    };
  }

  const membership = user.memberships[0] ?? null;

  if (audience === "TENANT") {
    if (!membership) {
      return { error: "Your account is not linked to a group yet. Ask your group admin." };
    }
    // A paused or closed group must not be able to record money.
    if (membership.group.status !== "ACTIVE") {
      return { error: `${membership.group.name} is not active. Please contact BhishiBook.` };
    }
  }

  attempts.delete(email);

  await createSession({
    userId: user.id,
    role: user.role,
    groupId: user.role === "SUPER_ADMIN" ? null : (membership?.groupId ?? null),
    memberId: membership?.id ?? null,
    name: user.name,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      groupId: membership?.groupId ?? null,
      actorUserId: user.id,
      action: audience === "PLATFORM" ? "LOGIN_PLATFORM" : "LOGIN",
      entityType: "User",
      entityId: user.id,
    },
  });

  // Only accept an internal path, so ?next= cannot bounce someone to another site.
  const destination =
    next.startsWith("/") && !next.startsWith("//") ? next : homePathFor(user.role);

  // redirect() throws internally, so it must sit outside any try/catch.
  redirect(destination);
}

export async function loginTenant(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  return signIn(formData, "TENANT");
}

export async function loginPlatform(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  return signIn(formData, "PLATFORM");
}

export async function logout(): Promise<void> {
  // Read who is leaving before the session goes, so they land back on the
  // door they came in through.
  const session = await readSessionCookie();
  const returnTo = session?.role === "SUPER_ADMIN" ? "/superadmin/login" : "/login";

  const cookieStore = await cookies();
  // Clear the superadmin's working-group selection too, so the next person to
  // sign in on this device does not inherit it.
  cookieStore.delete(SELECTED_GROUP_COOKIE);
  await destroySession();

  redirect(returnTo);
}
