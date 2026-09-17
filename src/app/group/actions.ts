"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
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
import { reverseLedgerEntry, writeAudit } from "@/lib/services/ledger";
import {
  addMember,
  inviteMemberLogin,
  recordDefaultDecision,
  resetMemberPassword,
  updateMember,
} from "@/lib/services/members";
import { closeCycleWithDistribution } from "@/lib/services/distribution";
import {
  createCycle,
  updateCycle,
  updateFineRule,
  updateGroupSettings,
} from "@/lib/services/groups";

/**
 * Server Actions for the group admin area.
 *
 * Every action starts with requireGroupAdmin(). That is not belt and braces:
 * Server Functions are reachable by direct POST, so the check inside the
 * action is the only thing standing between a crafted request and another
 * group's money. The groupId always comes from the session, never the form.
 */

export type { ActionState } from "@/lib/action-state";

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

function cycleFromForm(formData: FormData) {
  return {
    name: text(formData, "name"),
    startsOn: date(formData, "startsOn"),
    endsOn: date(formData, "endsOn"),
    contributionDueDay: Number(text(formData, "contributionDueDay") || "10"),
    monthlyInterestRate: text(formData, "monthlyInterestRate") || "3",
    maxRepaymentMonths: Number(text(formData, "maxRepaymentMonths") || "6"),
    maxLoanCorpusMultiple: text(formData, "maxLoanCorpusMultiple") || "2",
    distributionBase:
      text(formData, "distributionBase") === "CORPUS_PLUS_INTEREST"
        ? ("CORPUS_PLUS_INTEREST" as const)
        : ("INTEREST_ONLY" as const),
    distributeFines: text(formData, "distributeFines") === "yes",
  };
}

export async function createCycleAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const scope = await requireGroupAdmin();
    const cycle = await createCycle({
      groupId: scope.groupId,
      actorUserId: scope.userId,
      ...cycleFromForm(formData),
    });
    refresh();
    revalidatePath("/group/settings");
    return ok(`${cycle.name} started`);
  } catch (error) {
    return failure(error);
  }
}

export async function updateCycleAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const scope = await requireGroupAdmin();
    const cycle = await updateCycle({
      groupId: scope.groupId,
      cycleId: text(formData, "cycleId"),
      actorUserId: scope.userId,
      ...cycleFromForm(formData),
    });
    refresh();
    revalidatePath("/group/settings");
    return ok(`${cycle.name} updated`);
  } catch (error) {
    return failure(error);
  }
}

export async function updateGroupSettingsAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const scope = await requireGroupAdmin();
    const group = await updateGroupSettings({
      groupId: scope.groupId,
      actorUserId: scope.userId,
      name: text(formData, "name"),
      defaultLang: text(formData, "defaultLang"),
      poweredByEnabled: text(formData, "poweredByEnabled") !== "no",
    });
    refresh();
    revalidatePath("/group/settings");
    return ok(`${group.name} saved`);
  } catch (error) {
    return failure(error);
  }
}

export async function updateFineRuleAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const scope = await requireGroupAdmin();
    await updateFineRule({
      groupId: scope.groupId,
      actorUserId: scope.userId,
      fineRuleId: text(formData, "fineRuleId"),
      fixedPerDayPaise: money(formData, "fixedPerDay"),
      graceDays: Number(text(formData, "graceDays") || "0"),
      maxFineDays: Number(text(formData, "maxFineDays") || "0"),
      distributeFine: text(formData, "distributeFine") === "yes",
      active: text(formData, "active") !== "no",
    });
    refresh();
    revalidatePath("/group/settings");
    return ok("Fine rule saved. Run the fine update to apply it to existing months.");
  } catch (error) {
    return failure(error);
  }
}

export async function inviteMemberLoginAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const scope = await requireGroupAdmin();
    const user = await inviteMemberLogin({
      groupId: scope.groupId,
      actorUserId: scope.userId,
      memberId: text(formData, "memberId"),
      email: text(formData, "email"),
      password: String(formData.get("password") ?? ""),
      preferredLang: text(formData, "preferredLang"),
    });
    refresh();
    return ok(`${user.email} can now sign in at /login`);
  } catch (error) {
    return failure(error);
  }
}

export async function resetMemberPasswordAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const scope = await requireGroupAdmin();
    await resetMemberPassword({
      groupId: scope.groupId,
      actorUserId: scope.userId,
      memberId: text(formData, "memberId"),
      password: String(formData.get("password") ?? ""),
    });
    refresh();
    return ok("Password changed");
  } catch (error) {
    return failure(error);
  }
}

const DECISIONS = [
  "PENDING",
  "RETURN_FULL",
  "RETURN_PARTIAL",
  "RETURN_NONE",
  "CARRY_FORWARD",
  "CUSTOM",
] as const;

export async function recordDefaultDecisionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const scope = await requireGroupAdmin();
    const decision = text(formData, "decision") as (typeof DECISIONS)[number];
    if (!DECISIONS.includes(decision)) return { error: "Choose a decision" };

    await recordDefaultDecision({
      groupId: scope.groupId,
      actorUserId: scope.userId,
      memberId: text(formData, "memberId"),
      decision,
      note: text(formData, "note") || undefined,
    });
    refresh();
    return ok("Decision recorded");
  } catch (error) {
    return failure(error);
  }
}

/**
 * Undo a ledger posting.
 *
 * The entry is not deleted; a REVERSAL is posted against it, which is the rule
 * the group agreed on for correcting mistakes.
 */
export async function reverseLedgerEntryAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const scope = await requireGroupAdmin();
    const entryId = text(formData, "entryId");
    const reason = text(formData, "reason");
    if (!reason) return { error: "Give a reason for the reversal" };

    await prisma.$transaction(async (tx) => {
      // Scoped by groupId so one group cannot reverse another group's entry.
      const entry = await tx.ledgerEntry.findFirst({
        where: { id: entryId, groupId: scope.groupId },
        select: { id: true },
      });
      if (!entry) throw new Error("That ledger entry could not be found in this group");

      await reverseLedgerEntry(tx, entry.id, reason);
      await writeAudit(tx, {
        groupId: scope.groupId,
        actorUserId: scope.userId,
        action: "REVERSE_LEDGER_ENTRY",
        entityType: "LedgerEntry",
        entityId: entry.id,
        newValue: { reason },
      });
    });

    refresh();
    return ok("Reversal posted");
  } catch (error) {
    return failure(error);
  }
}
