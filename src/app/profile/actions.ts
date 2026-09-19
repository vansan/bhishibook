"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { getMessages } from "@/lib/i18n";
import { hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { formatPhoneNumber } from "@/lib/members";

export type ActionResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
};

export async function updateProfileAction(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAuth();
  const t = await getMessages();

  const name = formData.get("name")?.toString().trim();
  const email = formData.get("email")?.toString().trim().toLowerCase();
  const rawPhone = formData.get("phone")?.toString().trim();

  if (!name) {
    return { error: "Name cannot be empty." };
  }
  if (!email || !email.includes("@")) {
    return { error: "A valid email address is required." };
  }

  // Check email uniqueness if email changed
  if (email !== auth.email.toLowerCase()) {
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing && existing.id !== auth.userId) {
      return { error: "This email address is already in use." };
    }
  }

  const phone = rawPhone ? formatPhoneNumber(rawPhone) : null;

  // Update User
  await prisma.user.update({
    where: { id: auth.userId },
    data: { name, email },
  });

  // If user is linked to a GroupMember, update GroupMember as well
  if (auth.memberId) {
    await prisma.groupMember.update({
      where: { id: auth.memberId },
      data: {
        displayName: name,
        email,
        phone,
      },
    });
  }

  revalidatePath("/profile");
  revalidatePath("/group/members");
  revalidatePath("/member");

  return { ok: true, message: t.profile.profileUpdated };
}

export async function changePasswordAction(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAuth();
  const t = await getMessages();

  const currentPassword = formData.get("currentPassword")?.toString() ?? "";
  const newPassword = formData.get("newPassword")?.toString() ?? "";
  const confirmPassword = formData.get("confirmPassword")?.toString() ?? "";

  if (newPassword !== confirmPassword) {
    return { error: t.profile.passwordMismatch };
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { passwordHash: true },
  });

  if (!user?.passwordHash) {
    return { error: "User password not set." };
  }

  const isValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!isValid) {
    return { error: t.profile.wrongPassword };
  }

  const newHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: auth.userId },
    data: { passwordHash: newHash },
  });

  revalidatePath("/profile");

  return { ok: true, message: t.profile.passwordUpdated };
}
