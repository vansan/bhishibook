import "server-only";
import type { FineTarget } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assessMonthlyFine,
  dueDateFor,
  monthsBetween,
  yearMonthOf,
  type YearMonth,
} from "@/lib/finance";
import {
  atLeastZero,
  decimalToPaise,
  paiseToDecimalString,
  type Paise,
} from "@/lib/money";
import { buildReceiptText } from "@/lib/receipt-text";
import {
  assertPeriodOpen,
  issueReceipt,
  postLedger,
  writeAudit,
  type Tx,
} from "./ledger";

/**
 * Monthly hafta: generating the schedule, recording payments, and keeping each
 * month's fine in step with what has actually been paid.
 */

export type FineRuleSnapshot = {
  fixedPerDayPaise: Paise;
  graceDays: number;
  maxFineDays: number;
  active: boolean;
};

const NO_FINE: FineRuleSnapshot = {
  fixedPerDayPaise: 0,
  graceDays: 0,
  maxFineDays: 0,
  active: false,
};

export async function getFineRule(
  tx: Tx,
  groupId: string,
  appliesTo: FineTarget
): Promise<FineRuleSnapshot> {
  const rule = await tx.fineRule.findUnique({
    where: { groupId_appliesTo: { groupId, appliesTo } },
    select: { fixedPerDay: true, graceDays: true, maxFineDays: true, active: true },
  });

  if (!rule) return NO_FINE;

  return {
    fixedPerDayPaise: decimalToPaise(rule.fixedPerDay),
    graceDays: rule.graceDays,
    maxFineDays: rule.maxFineDays,
    active: rule.active,
  };
}

/**
 * Create the Contribution rows a cycle needs.
 *
 * Idempotent: it skips any month a member already has a row for, so it is safe
 * to run again after adding a member mid-cycle. Rows are only created up to
 * the current month, so the group is not shown a wall of future dues.
 */
export async function generateContributionSchedule(input: {
  groupId: string;
  cycleId: string;
  asOf?: Date;
  actorUserId?: string | null;
}): Promise<{ created: number; months: number }> {
  const asOf = input.asOf ?? new Date();

  return prisma.$transaction(async (tx) => {
    const cycle = await tx.cycle.findFirstOrThrow({
      where: { id: input.cycleId, groupId: input.groupId },
      select: { id: true, startsOn: true, endsOn: true },
    });

    const members = await tx.groupMember.findMany({
      where: { groupId: input.groupId, status: { not: "INACTIVE" } },
      select: { id: true, monthlyHafta: true, joinedAt: true },
    });

    // Never generate past the end of the cycle or past today.
    const horizon = asOf < cycle.endsOn ? asOf : cycle.endsOn;
    const months = monthsBetween(cycle.startsOn, horizon);

    const existing = await tx.contribution.findMany({
      where: { cycleId: cycle.id },
      select: { memberId: true, month: true, year: true },
    });
    const seen = new Set(existing.map((row) => `${row.memberId}:${row.year}-${row.month}`));

    const locks = await tx.periodLock.findMany({
      where: { cycleId: cycle.id },
      select: { month: true, year: true },
    });
    const locked = new Set(locks.map((lock) => `${lock.year}-${lock.month}`));

    const rows: Array<{
      cycleId: string;
      memberId: string;
      month: number;
      year: number;
      amountDue: string;
    }> = [];

    for (const member of members) {
      const joined = yearMonthOf(member.joinedAt);
      for (const period of months) {
        const key = `${member.id}:${period.year}-${period.month}`;
        if (seen.has(key)) continue;
        if (locked.has(`${period.year}-${period.month}`)) continue;
        // A member who joined in March owes nothing for January.
        if (period.year < joined.year) continue;
        if (period.year === joined.year && period.month < joined.month) continue;

        rows.push({
          cycleId: cycle.id,
          memberId: member.id,
          month: period.month,
          year: period.year,
          amountDue: member.monthlyHafta.toFixed(2),
        });
      }
    }

    if (rows.length > 0) {
      await tx.contribution.createMany({ data: rows, skipDuplicates: true });
      await writeAudit(tx, {
        groupId: input.groupId,
        actorUserId: input.actorUserId,
        action: "GENERATE_CONTRIBUTION_SCHEDULE",
        entityType: "Cycle",
        entityId: cycle.id,
        newValue: { created: rows.length, months: months.length },
      });
    }

    return { created: rows.length, months: months.length };
  });
}

/**
 * Recompute the fine on one contribution and store it.
 *
 * Unpaid months keep accruing, so this is called both when a payment is
 * recorded and when the admin runs the fine assessment. Payments already made
 * against the fine and any waiver are preserved; only the assessed amount and
 * the day count move.
 */
export async function syncContributionFine(
  tx: Tx,
  input: {
    contributionId: string;
    cycleId: string;
    memberId: string;
    period: YearMonth;
    dueDay: number;
    amountDuePaise: Paise;
    amountPaidPaise: Paise;
    paidOn: Date | null;
    rule: FineRuleSnapshot;
    asOf: Date;
  }
) {
  const assessment = assessMonthlyFine({
    period: input.period,
    dueDay: input.dueDay,
    amountDuePaise: input.amountDuePaise,
    amountPaidPaise: input.amountPaidPaise,
    paidOn: input.paidOn,
    asOf: input.asOf,
    rule: input.rule,
  });

  const existing = await tx.fine.findUnique({
    where: { contributionId: input.contributionId },
    select: { id: true, amountPaid: true, waivedAmount: true },
  });

  if (assessment.amountPaise <= 0) {
    // Nothing owed. Remove an assessed-but-untouched fine (an early payment
    // correction), but never remove one that has money or a waiver on it.
    if (existing && decimalToPaise(existing.amountPaid) === 0 && decimalToPaise(existing.waivedAmount) === 0) {
      await tx.fine.delete({ where: { id: existing.id } });
    }
    return null;
  }

  const data = {
    daysLate: assessment.daysLate,
    amount: paiseToDecimalString(assessment.amountPaise),
  };

  if (existing) {
    return tx.fine.update({ where: { id: existing.id }, data });
  }

  return tx.fine.create({
    data: {
      cycleId: input.cycleId,
      memberId: input.memberId,
      contributionId: input.contributionId,
      fineType: "CONTRIBUTION",
      month: input.period.month,
      year: input.period.year,
      ...data,
    },
  });
}

export type ContributionPaymentResult = {
  receiptNo: string;
  appliedPaise: Paise;
  finePaise: Paise;
  whatsappText: string;
};

/**
 * Record a hafta payment.
 *
 * Everything lands in one transaction: the contribution, its fine, the ledger
 * entry, the receipt, and the audit row.
 */
export async function recordContributionPayment(input: {
  groupId: string;
  contributionId: string;
  amountPaise: Paise;
  paidOn: Date;
  finePaidPaise?: Paise;
  notes?: string;
  actorUserId?: string | null;
}): Promise<ContributionPaymentResult> {
  if (input.amountPaise <= 0 && (input.finePaidPaise ?? 0) <= 0) {
    throw new Error("Enter an amount to record");
  }

  return prisma.$transaction(async (tx) => {
    const contribution = await tx.contribution.findFirstOrThrow({
      // groupId is in the filter so an id from another group cannot be paid.
      where: { id: input.contributionId, cycle: { groupId: input.groupId } },
      select: {
        id: true,
        cycleId: true,
        memberId: true,
        month: true,
        year: true,
        amountDue: true,
        amountPaid: true,
        cycle: { select: { contributionDueDay: true, group: { select: { name: true } } } },
        member: { select: { displayName: true, phone: true } },
      },
    });

    await assertPeriodOpen(tx, contribution.cycleId, contribution.year, contribution.month);

    const duePaise = decimalToPaise(contribution.amountDue);
    const alreadyPaidPaise = decimalToPaise(contribution.amountPaid);
    // Never let a member be recorded as paying more than the month's hafta.
    const appliedPaise = Math.min(input.amountPaise, atLeastZero(duePaise - alreadyPaidPaise));
    const newPaidPaise = alreadyPaidPaise + appliedPaise;
    const fullySettled = newPaidPaise >= duePaise;

    const updated = await tx.contribution.update({
      where: { id: contribution.id },
      data: {
        amountPaid: paiseToDecimalString(newPaidPaise),
        paidOn: fullySettled ? input.paidOn : null,
        notes: input.notes ?? undefined,
      },
      select: { id: true },
    });

    const period = { year: contribution.year, month: contribution.month };
    const rule = await getFineRule(tx, input.groupId, "CONTRIBUTION");

    const fine = await syncContributionFine(tx, {
      contributionId: updated.id,
      cycleId: contribution.cycleId,
      memberId: contribution.memberId,
      period,
      dueDay: contribution.cycle.contributionDueDay,
      amountDuePaise: duePaise,
      amountPaidPaise: newPaidPaise,
      paidOn: fullySettled ? input.paidOn : null,
      rule,
      asOf: input.paidOn,
    });

    // Fine money is optional: an admin may collect the hafta today and the
    // fine later, so only what was actually handed over is recorded.
    let finePaidPaise = 0;
    if (fine && (input.finePaidPaise ?? 0) > 0) {
      const fineRow = await tx.fine.findUniqueOrThrow({
        where: { id: fine.id },
        select: { amount: true, amountPaid: true, waivedAmount: true },
      });
      const outstanding = atLeastZero(
        decimalToPaise(fineRow.amount) -
          decimalToPaise(fineRow.amountPaid) -
          decimalToPaise(fineRow.waivedAmount)
      );
      finePaidPaise = Math.min(input.finePaidPaise ?? 0, outstanding);

      if (finePaidPaise > 0) {
        await tx.fine.update({
          where: { id: fine.id },
          data: {
            amountPaid: paiseToDecimalString(
              decimalToPaise(fineRow.amountPaid) + finePaidPaise
            ),
          },
        });
      }
    }

    if (appliedPaise > 0) {
      await postLedger(tx, {
        groupId: input.groupId,
        cycleId: contribution.cycleId,
        entryType: "CONTRIBUTION",
        amountPaise: appliedPaise,
        entryDate: input.paidOn,
        description: `Hafta from ${contribution.member.displayName} for ${period.month}/${period.year}`,
        referenceType: "Contribution",
        referenceId: contribution.id,
      });
    }

    if (finePaidPaise > 0) {
      await postLedger(tx, {
        groupId: input.groupId,
        cycleId: contribution.cycleId,
        entryType: "CONTRIBUTION_FINE",
        amountPaise: finePaidPaise,
        entryDate: input.paidOn,
        description: `Late fine from ${contribution.member.displayName} for ${period.month}/${period.year}`,
        referenceType: "Fine",
        referenceId: fine?.id,
      });
    }

    const totalPaise = appliedPaise + finePaidPaise;
    const issuedAt = input.paidOn;

    const receipt = await issueReceipt(tx, {
      groupId: input.groupId,
      cycleId: contribution.cycleId,
      memberId: contribution.memberId,
      contributionId: contribution.id,
      fineId: fine?.id ?? null,
      receiptType: "CONTRIBUTION",
      amountPaise: totalPaise,
      issuedAt,
      whatsappText: "",
    });

    const whatsappText = buildReceiptText({
      groupName: contribution.cycle.group.name,
      receiptNo: receipt.receiptNo,
      memberName: contribution.member.displayName,
      issuedAt,
      period,
      lines: [
        { label: "Hafta", amountPaise: appliedPaise },
        { label: "Late fine", amountPaise: finePaidPaise },
      ],
      totalPaise,
    });

    await tx.receipt.update({ where: { id: receipt.id }, data: { whatsappText } });

    await writeAudit(tx, {
      groupId: input.groupId,
      actorUserId: input.actorUserId,
      action: "RECORD_CONTRIBUTION_PAYMENT",
      entityType: "Contribution",
      entityId: contribution.id,
      oldValue: { amountPaid: alreadyPaidPaise },
      newValue: { amountPaid: newPaidPaise, finePaid: finePaidPaise, receiptNo: receipt.receiptNo },
    });

    return {
      receiptNo: receipt.receiptNo,
      appliedPaise,
      finePaise: finePaidPaise,
      whatsappText,
    };
  });
}

/**
 * Bring every fine in a cycle up to date.
 *
 * Fines on unpaid months grow every day, so the stored figures are only
 * correct as of the last time this ran. The admin triggers it from the fines
 * screen before reviewing or collecting.
 */
export async function runFineAssessment(input: {
  groupId: string;
  cycleId: string;
  asOf?: Date;
  actorUserId?: string | null;
}): Promise<{ assessed: number; totalPaise: Paise }> {
  const asOf = input.asOf ?? new Date();

  return prisma.$transaction(
    async (tx) => {
      const cycle = await tx.cycle.findFirstOrThrow({
        where: { id: input.cycleId, groupId: input.groupId },
        select: { id: true, contributionDueDay: true },
      });

      const locks = await tx.periodLock.findMany({
        where: { cycleId: cycle.id },
        select: { month: true, year: true },
      });
      const locked = new Set(locks.map((lock) => `${lock.year}-${lock.month}`));

      const [contributionRule, interestRule] = await Promise.all([
        getFineRule(tx, input.groupId, "CONTRIBUTION"),
        getFineRule(tx, input.groupId, "INTEREST"),
      ]);

      const contributions = await tx.contribution.findMany({
        where: { cycleId: cycle.id },
        select: {
          id: true,
          memberId: true,
          month: true,
          year: true,
          amountDue: true,
          amountPaid: true,
          paidOn: true,
        },
      });

      let assessed = 0;
      let totalPaise = 0;

      for (const row of contributions) {
        if (locked.has(`${row.year}-${row.month}`)) continue;
        const fine = await syncContributionFine(tx, {
          contributionId: row.id,
          cycleId: cycle.id,
          memberId: row.memberId,
          period: { year: row.year, month: row.month },
          dueDay: cycle.contributionDueDay,
          amountDuePaise: decimalToPaise(row.amountDue),
          amountPaidPaise: decimalToPaise(row.amountPaid),
          paidOn: row.paidOn,
          rule: contributionRule,
          asOf,
        });
        if (fine) {
          assessed += 1;
          totalPaise += decimalToPaise(fine.amount);
        }
      }

      // The same treatment for each month of loan interest, using the separate
      // interest fine rule the group asked for.
      const interestDues = await tx.interestDue.findMany({
        where: { cycleId: cycle.id },
        select: {
          id: true,
          memberId: true,
          loanId: true,
          month: true,
          year: true,
          amountDue: true,
          amountPaid: true,
          paidOn: true,
        },
      });

      for (const row of interestDues) {
        if (locked.has(`${row.year}-${row.month}`)) continue;

        const assessment = assessMonthlyFine({
          period: { year: row.year, month: row.month },
          dueDay: cycle.contributionDueDay,
          amountDuePaise: decimalToPaise(row.amountDue),
          amountPaidPaise: decimalToPaise(row.amountPaid),
          paidOn: row.paidOn,
          asOf,
          rule: interestRule,
        });

        const existing = await tx.fine.findUnique({
          where: { interestDueId: row.id },
          select: { id: true, amountPaid: true, waivedAmount: true },
        });

        if (assessment.amountPaise <= 0) {
          if (
            existing &&
            decimalToPaise(existing.amountPaid) === 0 &&
            decimalToPaise(existing.waivedAmount) === 0
          ) {
            await tx.fine.delete({ where: { id: existing.id } });
          }
          continue;
        }

        const data = {
          daysLate: assessment.daysLate,
          amount: paiseToDecimalString(assessment.amountPaise),
        };

        if (existing) {
          await tx.fine.update({ where: { id: existing.id }, data });
        } else {
          await tx.fine.create({
            data: {
              cycleId: cycle.id,
              memberId: row.memberId,
              interestDueId: row.id,
              loanId: row.loanId,
              fineType: "INTEREST",
              month: row.month,
              year: row.year,
              ...data,
            },
          });
        }

        assessed += 1;
        totalPaise += assessment.amountPaise;
      }

      await writeAudit(tx, {
        groupId: input.groupId,
        actorUserId: input.actorUserId,
        action: "RUN_FINE_ASSESSMENT",
        entityType: "Cycle",
        entityId: cycle.id,
        newValue: { assessed, totalPaise, asOf: asOf.toISOString() },
      });

      return { assessed, totalPaise };
    },
    // A full cycle of members times months can exceed the default budget.
    { timeout: 30_000 }
  );
}

/** Forgive part or all of a fine. Recorded, never deleted. */
export async function waiveFine(input: {
  groupId: string;
  fineId: string;
  waivePaise: Paise;
  reason: string;
  actorUserId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const fine = await tx.fine.findFirstOrThrow({
      where: { id: input.fineId, cycle: { groupId: input.groupId } },
      select: { id: true, amount: true, amountPaid: true, waivedAmount: true, notes: true },
    });

    const outstanding = atLeastZero(
      decimalToPaise(fine.amount) -
        decimalToPaise(fine.amountPaid) -
        decimalToPaise(fine.waivedAmount)
    );
    const waivePaise = Math.min(atLeastZero(input.waivePaise), outstanding);
    if (waivePaise <= 0) throw new Error("There is nothing left to waive on this fine");

    const updated = await tx.fine.update({
      where: { id: fine.id },
      data: {
        waivedAmount: paiseToDecimalString(decimalToPaise(fine.waivedAmount) + waivePaise),
        notes: [fine.notes, `Waived: ${input.reason}`].filter(Boolean).join(" | "),
      },
    });

    await writeAudit(tx, {
      groupId: input.groupId,
      actorUserId: input.actorUserId,
      action: "WAIVE_FINE",
      entityType: "Fine",
      entityId: fine.id,
      oldValue: { waived: decimalToPaise(fine.waivedAmount) },
      newValue: { waived: decimalToPaise(updated.waivedAmount), reason: input.reason },
    });

    return updated;
  });
}
