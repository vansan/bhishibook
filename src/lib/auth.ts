import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readSessionCookie } from "@/lib/session";

/**
 * The data access layer.
 *
 * Server Functions are reachable by direct POST, not only through the UI, so
 * the Next.js docs are explicit that every one of them must check auth itself.
 * These helpers are that check: no page, action, or query should read the
 * session cookie directly, and none should accept a groupId from the client
 * without running it through `requireGroupScope`.
 *
 * The cookie alone is never trusted for authorisation. It is verified against
 * the database on every request, so deactivating a user or removing them from
 * a group takes effect immediately rather than when their token expires.
 */

export type AuthContext = {
  userId: string;
  role: UserRole;
  name: string;
  email: string;
  preferredLang: string;
  /** The group this user belongs to. Null for a superadmin. */
  groupId: string | null;
  /** Their GroupMember row in that group, when they have one. */
  memberId: string | null;
};

/**
 * Deduped for the lifetime of one request, so a layout and three components
 * asking who is logged in cause one database round trip, not four.
 */
export const getAuth = cache(async (): Promise<AuthContext | null> => {
  const session = await readSessionCookie();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      preferredLang: true,
      memberships: {
        where: { status: { not: "INACTIVE" } },
        select: { id: true, groupId: true },
        orderBy: { joinedAt: "asc" },
        take: 1,
      },
    },
  });

  if (!user || !user.isActive) return null;

  const membership = user.memberships[0] ?? null;

  return {
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    preferredLang: user.preferredLang,
    groupId: user.role === "SUPER_ADMIN" ? null : (membership?.groupId ?? null),
    memberId: membership?.id ?? null,
  };
});

/** A group is a tenant, so each audience has its own sign-in page. */
export const TENANT_LOGIN_PATH = "/login";
export const PLATFORM_LOGIN_PATH = "/superadmin/login";

export async function requireAuth(loginPath = TENANT_LOGIN_PATH): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) redirect(loginPath);
  return auth;
}

export async function requireRole(...roles: UserRole[]): Promise<AuthContext> {
  const auth = await requireAuth();
  if (!roles.includes(auth.role)) redirect("/denied");
  return auth;
}

export async function requireSuperAdmin(): Promise<AuthContext> {
  // Bounce to the platform door, not the tenant one.
  const auth = await requireAuth(PLATFORM_LOGIN_PATH);
  if (auth.role !== "SUPER_ADMIN") redirect("/denied");
  return auth;
}

export type GroupScope = AuthContext & { groupId: string };

/**
 * Resolve and authorise the group a request is acting on.
 *
 * A group admin or member is pinned to their own group and any other groupId
 * is refused, which is what stops one group from reading or writing another
 * group's money. A superadmin may name any group, but must name one.
 */
export async function requireGroupScope(requestedGroupId?: string): Promise<GroupScope> {
  const auth = await requireAuth();

  if (auth.role === "SUPER_ADMIN") {
    // A superadmin is not tied to one group, so they carry their current
    // selection in a cookie set from the superadmin group list. Without it,
    // "the oldest group" is picked, which is wrong as soon as there are two.
    const groupId = requestedGroupId ?? (await selectedGroupId()) ?? (await firstGroupId());
    if (!groupId) redirect("/superadmin");
    return { ...auth, groupId };
  }

  if (!auth.groupId) redirect("/denied");
  if (requestedGroupId && requestedGroupId !== auth.groupId) redirect("/denied");
  return { ...auth, groupId: auth.groupId };
}

/** Group scope that also requires write access. Members are read-only. */
export async function requireGroupAdmin(requestedGroupId?: string): Promise<GroupScope> {
  const scope = await requireGroupScope(requestedGroupId);
  if (scope.role !== "GROUP_ADMIN" && scope.role !== "SUPER_ADMIN") redirect("/denied");
  return scope;
}

/**
 * The member whose passbook is being viewed.
 * A member may only ever see their own.
 */
export async function requireMemberScope(
  requestedMemberId?: string
): Promise<GroupScope & { memberId: string }> {
  const scope = await requireGroupScope();

  if (scope.role === "MEMBER") {
    if (!scope.memberId) redirect("/denied");
    if (requestedMemberId && requestedMemberId !== scope.memberId) redirect("/denied");
    return { ...scope, memberId: scope.memberId };
  }

  const memberId = requestedMemberId ?? scope.memberId;
  if (!memberId) redirect("/denied");

  // An admin may view any member, but only inside their own group.
  const member = await prisma.groupMember.findFirst({
    where: { id: memberId, groupId: scope.groupId },
    select: { id: true },
  });
  if (!member) redirect("/denied");

  return { ...scope, memberId };
}

export const SELECTED_GROUP_COOKIE = "bb_group";

/**
 * The group a superadmin is currently working inside.
 * Verified against the database, so a hand-edited cookie cannot point at a
 * group that does not exist.
 */
async function selectedGroupId(): Promise<string | null> {
  const cookieStore = await cookies();
  const candidate = cookieStore.get(SELECTED_GROUP_COOKIE)?.value;
  if (!candidate) return null;

  const group = await prisma.group.findUnique({
    where: { id: candidate },
    select: { id: true },
  });
  return group?.id ?? null;
}

async function firstGroupId(): Promise<string | null> {
  const group = await prisma.group.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return group?.id ?? null;
}

/** Where a user lands after logging in. */
export function homePathFor(role: UserRole): string {
  if (role === "SUPER_ADMIN") return "/superadmin";
  if (role === "GROUP_ADMIN") return "/group";
  return "/member";
}
