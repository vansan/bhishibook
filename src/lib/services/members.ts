import "server-only";
import type { MembershipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { paiseToDecimalString, type Paise } from "@/lib/money";
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
    const member = await tx.groupMember.update({
      where: { id: input.memberId },
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
