import "server-only";
import type { MembershipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { paiseToDecimalString, type Paise } from "@/lib/money";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/password";
import { writeAudit } from "./ledger";

/**
 * Members are never deleted.
 *
 * A member who leaves is marked INACTIVE so their contributions, loans, and
 * receipts stay attached to the history. Deleting the row would orphan money
 * that has already moved.
 */

export type MemberInput = {
  displayName: string;
  phone?: string | null;
  email?: string | null;
  shareCount: number;
  monthlyHaftaPaise: Paise;
};

function validate(input: MemberInput): void {
  if (!input.displayName.trim()) throw new Error("Name is required");
  if (!Number.isInteger(input.shareCount) || input.shareCount < 1) {
    throw new Error("Shares must be a whole number of at least 1");
  }
  if (input.monthlyHaftaPaise <= 0) throw new Error("Monthly hafta must be more than zero");
}

export async function addMember(input: MemberInput & {
  groupId: string;
  actorUserId?: string | null;
}) {
  validate(input);

  return prisma.$transaction(async (tx) => {
    const member = await tx.groupMember.create({
      data: {
        groupId: input.groupId,
        displayName: input.displayName.trim(),
        phone: input.phone?.trim() || null,
        email: input.email?.trim().toLowerCase() || null,
        shareCount: input.shareCount,
        monthlyHafta: paiseToDecimalString(input.monthlyHaftaPaise),
        status: "ACTIVE",
      },
    });

    await writeAudit(tx, {
      groupId: input.groupId,
      actorUserId: input.actorUserId,
      action: "ADD_MEMBER",
      entityType: "GroupMember",
      entityId: member.id,
      newValue: {
        displayName: member.displayName,
        shareCount: member.shareCount,
        monthlyHafta: input.monthlyHaftaPaise,
      },
    });

    return member;
  });
}

export async function updateMember(input: MemberInput & {
  groupId: string;
  memberId: string;
  status: MembershipStatus;
  actorUserId?: string | null;
}) {
  validate(input);

  return prisma.$transaction(async (tx) => {
    const before = await tx.groupMember.findFirstOrThrow({
      where: { id: input.memberId, groupId: input.groupId },
      select: {
        displayName: true,
        phone: true,
        email: true,
        shareCount: true,
        monthlyHafta: true,
        status: true,
      },
    });

    const member = await tx.groupMember.update({
      where: { id: input.memberId },
      data: {
        displayName: input.displayName.trim(),
        phone: input.phone?.trim() || null,
        email: input.email?.trim().toLowerCase() || null,
        shareCount: input.shareCount,
        monthlyHafta: paiseToDecimalString(input.monthlyHaftaPaise),
        status: input.status,
      },
    });

    await writeAudit(tx, {
      groupId: input.groupId,
      actorUserId: input.actorUserId,
      action: "UPDATE_MEMBER",
      entityType: "GroupMember",
      entityId: member.id,
      oldValue: {
        displayName: before.displayName,
        shareCount: before.shareCount,
        monthlyHafta: before.monthlyHafta.toFixed(2),
        status: before.status,
      },
      newValue: {
        displayName: member.displayName,
        shareCount: member.shareCount,
        monthlyHafta: member.monthlyHafta.toFixed(2),
        status: member.status,
      },
    });

    return member;
  });
}

/** Record the group's year-end decision about a member who defaulted. */
export async function recordDefaultDecision(input: {
  groupId: string;
  memberId: string;
  decision: "PENDING" | "RETURN_FULL" | "RETURN_PARTIAL" | "RETURN_NONE" | "CARRY_FORWARD" | "CUSTOM";
  note?: string;
  actorUserId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    // Scoped by groupId as well as id: updating by id alone would let one
    // group write a decision onto another group's member.
    const owned = await tx.groupMember.findFirst({
      where: { id: input.memberId, groupId: input.groupId },
      select: { id: true },
    });
    if (!owned) throw new Error("That member could not be found in this group");

    const member = await tx.groupMember.update({
      where: { id: owned.id },
      data: {
        defaultDecision: input.decision,
        defaultDecidedAt: input.decision === "PENDING" ? null : new Date(),
        defaultNote: input.note?.trim() || null,
      },
    });

    await writeAudit(tx, {
      groupId: input.groupId,
      actorUserId: input.actorUserId,
      action: "RECORD_DEFAULT_DECISION",
      entityType: "GroupMember",
      entityId: member.id,
      newValue: { decision: input.decision, note: input.note ?? null },
    });

    return member;
  });
}

/**
 * Give a member their own login.
 *
 * The admin sets a starting password and passes it on however they normally
 * reach that member. There is no email delivery yet, which is deliberate: a
 * free group should not need an SMTP account to get started.
 */
export async function inviteMemberLogin(input: {
  groupId: string;
  memberId: string;
  email: string;
  password: string;
  preferredLang?: string;
  actorUserId?: string | null;
}) {
  const email = input.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error("Enter a valid email address");
  }
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  const member = await prisma.groupMember.findFirst({
    where: { id: input.memberId, groupId: input.groupId },
    select: { id: true, displayName: true, userId: true },
  });
  if (!member) throw new Error("That member could not be found in this group");
  if (member.userId) throw new Error(`${member.displayName} already has a login`);

  const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (taken) throw new Error("A user with that email already exists");

  // Hashing is slow, so it happens before the transaction opens.
  const passwordHash = await hashPassword(input.password);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        name: member.displayName,
        role: "MEMBER",
        preferredLang: input.preferredLang === "mr" ? "mr" : "en",
        passwordHash,
      },
    });

    await tx.groupMember.update({
      where: { id: member.id },
      data: { userId: user.id, email },
    });

    await writeAudit(tx, {
      groupId: input.groupId,
      actorUserId: input.actorUserId,
      action: "INVITE_MEMBER_LOGIN",
      entityType: "GroupMember",
      entityId: member.id,
      newValue: { email, userId: user.id },
    });

    return user;
  });
}

/** Set a new password for a member who has forgotten theirs. */
export async function resetMemberPassword(input: {
  groupId: string;
  memberId: string;
  password: string;
  actorUserId?: string | null;
}) {
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  const member = await prisma.groupMember.findFirst({
    where: { id: input.memberId, groupId: input.groupId },
    select: { id: true, userId: true, displayName: true },
  });
  if (!member?.userId) throw new Error("That member does not have a login yet");

  const passwordHash = await hashPassword(input.password);

  return prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: member.userId! },
      data: { passwordHash },
    });

    await writeAudit(tx, {
      groupId: input.groupId,
      actorUserId: input.actorUserId,
      action: "RESET_MEMBER_PASSWORD",
      entityType: "GroupMember",
      entityId: member.id,
      // Never record the password itself, only that it was changed.
      newValue: { memberId: member.id },
    });

    return member;
  });
}
