"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { GroupStatus, PlanStatus } from "@prisma/client";
import { requireSuperAdmin, SELECTED_GROUP_COOKIE } from "@/lib/auth";
import { rupeesToPaise } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { createGroup, updateGroupStatus } from "@/lib/services/groups";

/**
 * Platform-level actions. Every one calls requireSuperAdmin first: these
 * create tenants and change their status, so they must never be reachable by
 * a group admin who crafts a POST.
 */

export type { ActionState } from "@/lib/action-state";

function failure(error: unknown): ActionState {
  const message = error instanceof Error ? error.message : "Something went wrong";
  if (message.includes("prisma") || message.includes("Invalid `")) {
    return { error: "That could not be saved. Please check the values and try again." };
  }
  return { error: message };
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

const STATUSES: GroupStatus[] = ["ACTIVE", "PAUSED", "CLOSED"];
const PLANS: PlanStatus[] = ["FREE", "TRIAL", "PAID", "SUSPENDED"];

export async function createGroupAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const auth = await requireSuperAdmin();
    const fineRaw = text(formData, "finePerDay").replace(/[₹,\s]/g, "") || "10";

    const { group, admin } = await createGroup({
      actorUserId: auth.userId,
      name: text(formData, "name"),
      defaultLang: text(formData, "defaultLang") || "en",
      currency: text(formData, "currency") || "INR",
      adminName: text(formData, "adminName"),
      adminEmail: text(formData, "adminEmail"),
      adminPassword: String(formData.get("adminPassword") ?? ""),
      finePerDayPaise: rupeesToPaise(fineRaw),
    });

    revalidatePath("/superadmin");
    return {
      success: `${group.name} created. ${admin.email} can now sign in at /login and start a cycle.`,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function setGroupStatusAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const auth = await requireSuperAdmin();

    const status = text(formData, "status") as GroupStatus;
    const planStatus = text(formData, "planStatus") as PlanStatus;
    if (!STATUSES.includes(status) || !PLANS.includes(planStatus)) {
      return { error: "Choose a valid status and plan" };
    }

    const group = await updateGroupStatus({
      groupId: text(formData, "groupId"),
      status,
      planStatus,
      actorUserId: auth.userId,
    });

    revalidatePath("/superadmin");
    return { success: `${group.name} updated` };
  } catch (error) {
    return failure(error);
  }
}

/**
 * Pick the group the superadmin is working inside.
 *
 * The choice is stored in a cookie that requireGroupScope re-checks against
 * the database, so it is a convenience, not a grant of access.
 */
export async function selectGroupAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const groupId = text(formData, "groupId");

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true },
  });
  if (!group) redirect("/superadmin");

  const cookieStore = await cookies();
  cookieStore.set(SELECTED_GROUP_COOKIE, group.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect("/group");
}
