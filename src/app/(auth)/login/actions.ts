"use server";

import { redirect } from "next/navigation";
import { homePathFor } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/session";

export type LoginState = { error?: string };

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

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
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
        select: { id: true, groupId: true },
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

  attempts.delete(email);
  const membership = user.memberships[0] ?? null;

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
      action: "LOGIN",
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

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
