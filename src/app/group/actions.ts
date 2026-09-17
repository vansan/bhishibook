"use server";

import { revalidatePath } from "next/cache";
import { requireGroupAdmin } from "@/lib/auth";
import { rupeesToPaise } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import {
  generateContributionSchedule,
  recordContributionPayment,
  runFineAssessment,
  waiveFine,
} from "@/lib/services/contributions";
import { createLoan, generateInterestDues, recordLoanRepayment } from "@/lib/services/loans";
import { writeAudit } from "@/lib/services/ledger";
import { addMember, updateMember } from "@/lib/services/members";
import { closeCycleWithDistribution } from "@/lib/services/distribution";

/**
 * Server Actions for the group admin area.
 *
 * Every action starts with requireGroupAdmin(). That is not belt and braces:
 * Server Functions are reachable by direct POST, so the check inside the
 * action is the only thing standing between a crafted request and another
 * group's money. The groupId always comes from the session, never the form.
 */

export type ActionState = { error?: string; success?: string };

const ok = (message: string): ActionState => ({ success: message });

/** Turn a thrown error into something an admin can read. */
function failure(error: unknown): ActionState {
  const message = error instanceof Error ? error.message : "Something went wrong";
  // Prisma's own errors are not for end users.
  if (message.includes("prisma") || message.includes("Invalid `")) {
    return { error: "That could not be saved. Please check the values and try again." };
  }
  return { error: message };
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function money(formData: FormData, key: string): number {
  const raw = text(formData, key).replace(/[₹,\s]/g, "");
  if (!raw) return 0;
  return rupeesToPaise(raw);
}

function date(formData: FormData, key: string): Date {
  const raw = text(formData, key);
  // Form dates are plain calendar days; parse them as UTC so the fine day
  // count does not shift with the server timezone.
  const parsed = raw ? new Date(`${raw}T00:00:00.000Z`) : new Date();
  if (Number.isNaN(parsed.getTime())) throw new Error("Enter a valid date");
  return parsed;
}

async function activeCycleId(groupId: string): Promise<string> {
  const cycle = await prisma.cycle.findFirst({
    where: { groupId, status: { in: ["ACTIVE", "DRAFT", "CLOSING"] } },
    orderBy: { startsOn: "desc" },
    select: { id: true },
  });
  if (!cycle) throw new Error("This group has no open cycle. Start one first.");
  return cycle.id;
}

function refresh(): void {
  for (const path of [
    "/group",
    "/group/members",
    "/group/contributions",
    "/group/loans",
    "/group/fines",
    "/group/ledger",
    "/member",
  ]) {
    revalidatePath(path);
  }
}

export async function addMemberAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const scope = await requireGroupAdmin();
    const member = await addMember({
      groupId: scope.groupId,
      actorUserId: scope.userId,
      displayName: text(formData, "displayName"),
      phone: text(formData, "phone"),
      email: text(formData, "email"),
      shareCount: Number(text(formData, "shareCount") || "1"),
      monthlyHaftaPaise: money(formData, "monthlyHafta"),
    });
    refresh();
    return ok(`${member.displayName} added`);
  } catch (error) {
    return failure(error);
  }
}

export async function updateMemberAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const scope = await requireGroupAdmin();
    const member = await updateMember({
      groupId: scope.groupId,
      actorUserId: scope.userId,
      memberId: text(formData, "memberId"),
      displayName: text(formData, "displayName"),
      phone: text(formData, "phone"),
      email: text(formData, "email"),
      shareCount: Number(text(formData, "shareCount") || "1"),
      monthlyHaftaPaise: money(formData, "monthlyHafta"),
      status: text(formData, "status") === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    });
    refresh();
    return ok(`${member.displayName} updated`);
  } catch (error) {
    return failure(error);
  }
}

export async function generateScheduleAction(
  _prev: ActionState,
  _formData: FormData
): Promise<ActionState> {
  try {
    const scope = await requireGroupAdmin();
    const cycleId = await activeCycleId(scope.groupId);
    const result = await generateContributionSchedule({
      groupId: scope.groupId,
      cycleId,
      actorUserId: scope.userId,
    });
    refresh();
    return ok(
      result.created > 0
        ? `${result.created} monthly dues created`
        : "Everything is already up to date"
    );
  } catch (error) {
    return failure(error);
  }
}

export async function recordContributionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const scope = await requireGroupAdmin();
    const result = await recordContributionPayment({
      groupId: scope.groupId,
      actorUserId: scope.userId,
      contributionId: text(formData, "contributionId"),
      amountPaise: money(formData, "amount"),
      finePaidPaise: money(formData, "finePaid"),
      paidOn: date(formData, "paidOn"),
      notes: text(formData, "notes") || undefined,
    });
    refresh();
    return ok(`Recorded. Receipt ${result.receiptNo}`);
  } catch (error) {
    return failure(error);
  }
}

export async function runFinesAction(
  _prev: ActionState,
  _formData: FormData
): Promise<ActionState> {
  try {
    const scope = await requireGroupAdmin();
    const cycleId = await activeCycleId(scope.groupId);
    const result = await runFineAssessment({
      groupId: scope.groupId,
      cycleId,
      actorUserId: scope.userId,
    });
    refresh();
    return ok(
      result.assessed > 0
        ? `${result.assessed} fines assessed`
        : "No fines are due right now"
    );
  } catch (error) {
    return failure(error);
  }
}

export async function waiveFineAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const scope = await requireGroupAdmin();
    await waiveFine({
      groupId: scope.groupId,
      actorUserId: scope.userId,
      fineId: text(formData, "fineId"),
      waivePaise: money(formData, "waiveAmount"),
      reason: text(formData, "reason") || "Waived by group decision",
    });
    refresh();
    return ok("Fine waived");
  } catch (error) {
    return failure(error);
  }
}

export async function createLoanAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const scope = await requireGroupAdmin();
    const cycleId = await activeCycleId(scope.groupId);
    const result = await createLoan({
      groupId: scope.groupId,
      actorUserId: scope.userId,
      cycleId,
      memberId: text(formData, "memberId"),
      principalPaise: money(formData, "principal"),
      disbursedOn: date(formData, "disbursedOn"),
      notes: text(formData, "notes") || undefined,
    });
    refresh();
    return ok(`Loan created. Receipt ${result.receiptNo}`);
  } catch (error) {
    return failure(error);
  }
}

export async function recordRepaymentAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const scope = await requireGroupAdmin();
    const result = await recordLoanRepayment({
      groupId: scope.groupId,
      actorUserId: scope.userId,
      loanId: text(formData, "loanId"),
      amountPaise: money(formData, "amount"),
      paidOn: date(formData, "paidOn"),
      notes: text(formData, "notes") || undefined,
    });
    refresh();
    return ok(`Recorded. Receipt ${result.receiptNo}`);
  } catch (error) {
    return failure(error);
  }
}

export async function generateInterestAction(
  _prev: ActionState,
  _formData: FormData
): Promise<ActionState> {
  try {
    const scope = await requireGroupAdmin();
    const cycleId = await activeCycleId(scope.groupId);
    const result = await generateInterestDues({
      groupId: scope.groupId,
      cycleId,
      actorUserId: scope.userId,
    });
    refresh();
    return ok(
      result.created > 0
        ? `${result.created} interest dues created`
        : "Interest dues are already up to date"
    );
  } catch (error) {
    return failure(error);
  }
}

/** Lock a reviewed month so its figures can no longer drift. */
export async function lockPeriodAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const scope = await requireGroupAdmin();
    const cycleId = await activeCycleId(scope.groupId);
    const year = Number(text(formData, "year"));
    const month = Number(text(formData, "month"));
    if (!year || !month) throw new Error("Choose a month to lock");

    const unlock = text(formData, "unlock") === "1";

    if (unlock) {
      await prisma.$transaction(async (tx) => {
        await tx.periodLock.deleteMany({ where: { cycleId, year, month } });
        await writeAudit(tx, {
          groupId: scope.groupId,
          actorUserId: scope.userId,
          action: "UNLOCK_PERIOD",
          entityType: "Cycle",
          entityId: cycleId,
          newValue: { year, month },
        });
      });
      refresh();
      return ok(`${month}/${year} reopened`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.periodLock.create({
        data: {
          groupId: scope.groupId,
          cycleId,
          year,
          month,
          lockedById: scope.userId,
          note: text(formData, "note") || null,
        },
      });
      await writeAudit(tx, {
        groupId: scope.groupId,
        actorUserId: scope.userId,
        action: "LOCK_PERIOD",
        entityType: "Cycle",
        entityId: cycleId,
        newValue: { year, month },
      });
    });

    refresh();
    return ok(`${month}/${year} locked`);
  } catch (error) {
    return failure(error);
  }
}

export async function closeCycleAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const scope = await requireGroupAdmin();
    const cycleId = text(formData, "cycleId") || (await activeCycleId(scope.groupId));

    // Closing a cycle pays everyone out and cannot be undone, so the admin has
    // to type the confirmation rather than hit a button by accident.
    if (text(formData, "confirm").toUpperCase() !== "CLOSE") {
      return { error: 'Type CLOSE in the box to confirm' };
    }

    const result = await closeCycleWithDistribution({
      groupId: scope.groupId,
      cycleId,
      actorUserId: scope.userId,
    });

    refresh();
    revalidatePath("/group/distribution");
    return ok(`Cycle closed. ${result.members} members settled.`);
  } catch (error) {
    return failure(error);
  }
}
