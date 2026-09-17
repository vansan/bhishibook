import "server-only";
import { prisma } from "@/lib/prisma";
import {
  allocateRepayment,
  checkLoanEligibility,
  interestSchedule,
  monthlyInterest,
} from "@/lib/finance";
import {
  atLeastZero,
  decimalToPaise,
  paiseToDecimalString,
  sumPaise,
  type Paise,
} from "@/lib/money";
import { buildReceiptText } from "@/lib/receipt-text";
import { issueReceipt, postLedger, writeAudit, type Tx } from "./ledger";

/**
 * Loans: disbursement, the monthly interest schedule, and repayments.
 *
 * The group's rules, all enforced here:
 *   - interest is a flat monthly percentage of the original principal
 *   - interest is payable every month, principal any time within 6 months
 *   - a member may borrow up to 2x the corpus they have contributed
 *   - a repayment clears fines first, then interest, then principal
 */

/** What a member has actually paid into the corpus, which sets their limit. */
async function corpusContributedPaise(tx: Tx, memberId: string): Promise<Paise> {
  const result = await tx.contribution.aggregate({
    where: { memberId },
    _sum: { amountPaid: true },
  });
  return decimalToPaise(result._sum.amountPaid);
}

async function outstandingPrincipalPaise(tx: Tx, memberId: string): Promise<Paise> {
  const [loans, repaid] = await Promise.all([
    tx.loan.findMany({
      where: { memberId, status: { in: ["ACTIVE", "DEFAULTED"] } },
      select: { principal: true },
    }),
    tx.loanRepayment.aggregate({
      where: { memberId, loan: { status: { in: ["ACTIVE", "DEFAULTED"] } } },
      _sum: { principalAmount: true },
    }),
  ]);

  return atLeastZero(
    sumPaise(loans.map((loan) => decimalToPaise(loan.principal))) -
      decimalToPaise(repaid._sum.principalAmount)
  );
}

/** Cash the group could lend right now. */
async function availableFundsPaise(tx: Tx, groupId: string): Promise<Paise> {
  const [contributions, repayments, loans, fines] = await Promise.all([
    tx.contribution.aggregate({
      where: { cycle: { groupId } },
      _sum: { amountPaid: true },
    }),
    tx.loanRepayment.aggregate({
      where: { loan: { cycle: { groupId } } },
      _sum: { principalAmount: true, interestAmount: true },
    }),
    tx.loan.aggregate({ where: { cycle: { groupId } }, _sum: { principal: true } }),
    tx.fine.aggregate({ where: { cycle: { groupId } }, _sum: { amountPaid: true } }),
  ]);

  return atLeastZero(
    decimalToPaise(contributions._sum.amountPaid) +
      decimalToPaise(repayments._sum.principalAmount) +
      decimalToPaise(repayments._sum.interestAmount) +
      decimalToPaise(fines._sum.amountPaid) -
      decimalToPaise(loans._sum.principal)
  );
}

export type LoanLimits = {
  corpusContributedPaise: Paise;
  maxLoanPaise: Paise;
  availableToBorrowPaise: Paise;
  groupAvailableFundsPaise: Paise;
};

/** What the new-loan form shows before anything is submitted. */
export async function getLoanLimits(
  groupId: string,
  memberId: string
): Promise<LoanLimits> {
  const [cycle, contributed, outstanding, funds] = await Promise.all([
    prisma.cycle.findFirst({
      where: { groupId },
      orderBy: { startsOn: "desc" },
      select: { maxLoanCorpusMultiple: true },
    }),
    corpusContributedPaise(prisma, memberId),
    outstandingPrincipalPaise(prisma, memberId),
    availableFundsPaise(prisma, groupId),
  ]);

  const multiple = cycle?.maxLoanCorpusMultiple.toFixed(2) ?? "2.00";
  const check = checkLoanEligibility({
    requestedPaise: 0,
    corpusContributedPaise: contributed,
    outstandingPrincipalPaise: outstanding,
    multiple,
    groupAvailableFundsPaise: funds,
  });

  return {
    corpusContributedPaise: contributed,
    maxLoanPaise: check.maxLoanPaise,
    availableToBorrowPaise: check.availablePaise,
    groupAvailableFundsPaise: funds,
  };
}

export async function createLoan(input: {
  groupId: string;
  cycleId: string;
  memberId: string;
  principalPaise: Paise;
  disbursedOn: Date;
  notes?: string;
  actorUserId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const cycle = await tx.cycle.findFirstOrThrow({
      where: { id: input.cycleId, groupId: input.groupId },
      select: {
        id: true,
        monthlyInterestRate: true,
        maxRepaymentMonths: true,
        maxLoanCorpusMultiple: true,
        status: true,
        group: { select: { name: true } },
      },
    });

    if (cycle.status === "CLOSED") {
      throw new Error("This cycle is closed. Start a new cycle to disburse a loan.");
    }

    const member = await tx.groupMember.findFirstOrThrow({
      where: { id: input.memberId, groupId: input.groupId },
      select: { id: true, displayName: true, status: true },
    });

    if (member.status !== "ACTIVE") {
      throw new Error(`${member.displayName} is not an active member`);
    }

    const [contributed, outstanding, funds] = await Promise.all([
      corpusContributedPaise(tx, member.id),
      outstandingPrincipalPaise(tx, member.id),
      availableFundsPaise(tx, input.groupId),
    ]);

    const eligibility = checkLoanEligibility({
      requestedPaise: input.principalPaise,
      corpusContributedPaise: contributed,
      outstandingPrincipalPaise: outstanding,
      multiple: cycle.maxLoanCorpusMultiple.toFixed(2),
      groupAvailableFundsPaise: funds,
    });

    if (!eligibility.allowed) {
      throw new Error(eligibility.reason ?? "This loan is not allowed");
    }

    // Principal must clear within the cycle's repayment window.
    const dueOn = new Date(input.disbursedOn);
    dueOn.setUTCMonth(dueOn.getUTCMonth() + cycle.maxRepaymentMonths);

    const loan = await tx.loan.create({
      data: {
        cycleId: cycle.id,
        memberId: member.id,
        principal: paiseToDecimalString(input.principalPaise),
        disbursedOn: input.disbursedOn,
        dueOn,
        interestRate: cycle.monthlyInterestRate,
        status: "ACTIVE",
        notes: input.notes,
      },
    });

    await postLedger(tx, {
      groupId: input.groupId,
      cycleId: cycle.id,
      entryType: "LOAN_DISBURSEMENT",
      amountPaise: input.principalPaise,
      entryDate: input.disbursedOn,
      description: `Loan to ${member.displayName}`,
      referenceType: "Loan",
      referenceId: loan.id,
    });

    const receipt = await issueReceipt(tx, {
      groupId: input.groupId,
      cycleId: cycle.id,
      memberId: member.id,
      loanId: loan.id,
      receiptType: "LOAN",
      amountPaise: input.principalPaise,
      issuedAt: input.disbursedOn,
    });

    const whatsappText = buildReceiptText({
      groupName: cycle.group.name,
      receiptNo: receipt.receiptNo,
      memberName: member.displayName,
      issuedAt: input.disbursedOn,
      lines: [{ label: "Loan disbursed", amountPaise: input.principalPaise }],
      totalPaise: input.principalPaise,
      footer: `Interest ${cycle.monthlyInterestRate.toFixed(2)}% per month. Principal due by ${dueOn.toISOString().slice(0, 10)}.\nPowered by BhishiBook`,
    });

    await tx.receipt.update({ where: { id: receipt.id }, data: { whatsappText } });

    await writeAudit(tx, {
      groupId: input.groupId,
      actorUserId: input.actorUserId,
      action: "CREATE_LOAN",
      entityType: "Loan",
      entityId: loan.id,
      newValue: {
        memberId: member.id,
        principal: input.principalPaise,
        dueOn: dueOn.toISOString(),
        receiptNo: receipt.receiptNo,
      },
    });

    return { loan, receiptNo: receipt.receiptNo, whatsappText };
  });
}

/**
 * Create the monthly interest rows every active loan owes.
 *
 * Idempotent, and safe to run repeatedly: the unique index on
 * (loanId, month, year) means a month can never be billed twice.
 */
export async function generateInterestDues(input: {
  groupId: string;
  cycleId: string;
  asOf?: Date;
  actorUserId?: string | null;
}): Promise<{ created: number }> {
  const asOf = input.asOf ?? new Date();

  return prisma.$transaction(async (tx) => {
    const cycle = await tx.cycle.findFirstOrThrow({
      where: { id: input.cycleId, groupId: input.groupId },
      select: { id: true, maxRepaymentMonths: true },
    });

    const loans = await tx.loan.findMany({
      where: { cycleId: cycle.id, status: { in: ["ACTIVE", "DEFAULTED"] } },
      select: {
        id: true,
        memberId: true,
        principal: true,
        interestRate: true,
        disbursedOn: true,
        closedOn: true,
      },
    });

    const rows: Array<{
      cycleId: string;
      loanId: string;
      memberId: string;
      month: number;
      year: number;
      amountDue: string;
    }> = [];

    for (const loan of loans) {
      const perMonthPaise = monthlyInterest({
        principalPaise: decimalToPaise(loan.principal),
        monthlyInterestRate: loan.interestRate.toFixed(2),
      });
      if (perMonthPaise <= 0) continue;

      const months = interestSchedule({
        disbursedOn: loan.disbursedOn,
        closedOn: loan.closedOn,
        asOf,
        maxRepaymentMonths: cycle.maxRepaymentMonths,
      });

      for (const period of months) {
        rows.push({
          cycleId: cycle.id,
          loanId: loan.id,
          memberId: loan.memberId,
          month: period.month,
          year: period.year,
          amountDue: paiseToDecimalString(perMonthPaise),
        });
      }
    }

    if (rows.length === 0) return { created: 0 };

    const result = await tx.interestDue.createMany({ data: rows, skipDuplicates: true });

    if (result.count > 0) {
      await writeAudit(tx, {
        groupId: input.groupId,
        actorUserId: input.actorUserId,
        action: "GENERATE_INTEREST_DUES",
        entityType: "Cycle",
        entityId: cycle.id,
        newValue: { created: result.count },
      });
    }

    return { created: result.count };
  });
}

export type LoanPosition = {
  loanId: string;
  memberName: string;
  principalPaise: Paise;
  outstandingPrincipalPaise: Paise;
  outstandingInterestPaise: Paise;
  outstandingFinePaise: Paise;
  totalOwedPaise: Paise;
};

export async function getLoanPosition(
  groupId: string,
  loanId: string
): Promise<LoanPosition | null> {
  const loan = await prisma.loan.findFirst({
    where: { id: loanId, cycle: { groupId } },
    select: {
      id: true,
      principal: true,
      member: { select: { displayName: true } },
      repayments: { select: { principalAmount: true } },
      interestDues: { select: { amountDue: true, amountPaid: true } },
      fines: { select: { amount: true, amountPaid: true, waivedAmount: true } },
    },
  });

  if (!loan) return null;

  const outstandingPrincipal = atLeastZero(
    decimalToPaise(loan.principal) -
      sumPaise(loan.repayments.map((r) => decimalToPaise(r.principalAmount)))
  );
  const outstandingInterest = sumPaise(
    loan.interestDues.map((due) =>
      atLeastZero(decimalToPaise(due.amountDue) - decimalToPaise(due.amountPaid))
    )
  );
  const outstandingFine = sumPaise(
    loan.fines.map((fine) =>
      atLeastZero(
        decimalToPaise(fine.amount) -
          decimalToPaise(fine.amountPaid) -
          decimalToPaise(fine.waivedAmount)
      )
    )
  );

  return {
    loanId: loan.id,
    memberName: loan.member.displayName,
    principalPaise: decimalToPaise(loan.principal),
    outstandingPrincipalPaise: outstandingPrincipal,
    outstandingInterestPaise: outstandingInterest,
    outstandingFinePaise: outstandingFine,
    totalOwedPaise: outstandingPrincipal + outstandingInterest + outstandingFine,
  };
}

/**
 * Record a repayment.
 *
 * The amount is split fine, then interest, then principal, and applied to the
 * oldest unpaid month first so a partial payment always clears the longest
 * standing debt.
 */
export async function recordLoanRepayment(input: {
  groupId: string;
  loanId: string;
  amountPaise: Paise;
  paidOn: Date;
  notes?: string;
  actorUserId?: string | null;
}) {
  if (input.amountPaise <= 0) throw new Error("Enter an amount to record");

  return prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findFirstOrThrow({
      where: { id: input.loanId, cycle: { groupId: input.groupId } },
      select: {
        id: true,
        cycleId: true,
        memberId: true,
        principal: true,
        status: true,
        member: { select: { displayName: true, phone: true } },
        cycle: { select: { group: { select: { name: true } } } },
        repayments: { select: { principalAmount: true } },
      },
    });

    if (loan.status === "CLOSED") throw new Error("This loan is already closed");

    const [interestDues, fines] = await Promise.all([
      tx.interestDue.findMany({
        where: { loanId: loan.id },
        orderBy: [{ year: "asc" }, { month: "asc" }],
        select: { id: true, amountDue: true, amountPaid: true, month: true, year: true },
      }),
      tx.fine.findMany({
        where: { loanId: loan.id },
        orderBy: [{ year: "asc" }, { month: "asc" }],
        select: { id: true, amount: true, amountPaid: true, waivedAmount: true },
      }),
    ]);

    const owedPrincipal = atLeastZero(
      decimalToPaise(loan.principal) -
        sumPaise(loan.repayments.map((r) => decimalToPaise(r.principalAmount)))
    );
    const owedInterest = sumPaise(
      interestDues.map((due) =>
        atLeastZero(decimalToPaise(due.amountDue) - decimalToPaise(due.amountPaid))
      )
    );
    const owedFine = sumPaise(
      fines.map((fine) =>
        atLeastZero(
          decimalToPaise(fine.amount) -
            decimalToPaise(fine.amountPaid) -
            decimalToPaise(fine.waivedAmount)
        )
      )
    );

    const allocation = allocateRepayment(input.amountPaise, {
      finePaise: owedFine,
      interestPaise: owedInterest,
      principalPaise: owedPrincipal,
    });

    if (allocation.unappliedPaise > 0) {
      throw new Error(
        `This loan only owes ${(owedFine + owedInterest + owedPrincipal) / 100}. Reduce the amount.`
      );
    }

    // Spread the fine and interest portions over the oldest months first.
    let fineLeft = allocation.toFinePaise;
    for (const fine of fines) {
      if (fineLeft <= 0) break;
      const outstanding = atLeastZero(
        decimalToPaise(fine.amount) -
          decimalToPaise(fine.amountPaid) -
          decimalToPaise(fine.waivedAmount)
      );
      const apply = Math.min(fineLeft, outstanding);
      if (apply <= 0) continue;
      await tx.fine.update({
        where: { id: fine.id },
        data: { amountPaid: paiseToDecimalString(decimalToPaise(fine.amountPaid) + apply) },
      });
      fineLeft -= apply;
    }

    let interestLeft = allocation.toInterestPaise;
    for (const due of interestDues) {
      if (interestLeft <= 0) break;
      const paid = decimalToPaise(due.amountPaid);
      const outstanding = atLeastZero(decimalToPaise(due.amountDue) - paid);
      const apply = Math.min(interestLeft, outstanding);
      if (apply <= 0) continue;
      const newPaid = paid + apply;
      await tx.interestDue.update({
        where: { id: due.id },
        data: {
          amountPaid: paiseToDecimalString(newPaid),
          paidOn: newPaid >= decimalToPaise(due.amountDue) ? input.paidOn : null,
        },
      });
      interestLeft -= apply;
    }

    const repayment = await tx.loanRepayment.create({
      data: {
        loanId: loan.id,
        memberId: loan.memberId,
        paidOn: input.paidOn,
        principalAmount: paiseToDecimalString(allocation.toPrincipalPaise),
        interestAmount: paiseToDecimalString(allocation.toInterestPaise),
        fineAmount: paiseToDecimalString(allocation.toFinePaise),
        notes: input.notes,
      },
    });

    const principalNowOwed = owedPrincipal - allocation.toPrincipalPaise;
    const fullyCleared =
      principalNowOwed <= 0 &&
      owedInterest - allocation.toInterestPaise <= 0 &&
      owedFine - allocation.toFinePaise <= 0;

    if (principalNowOwed <= 0) {
      await tx.loan.update({
        where: { id: loan.id },
        data: {
          principalClosed: true,
          ...(fullyCleared ? { status: "CLOSED", closedOn: input.paidOn } : {}),
        },
      });
    }

    const postings = [
      {
        type: "CONTRIBUTION_FINE" as const,
        amount: allocation.toFinePaise,
        label: "Late fine",
      },
      {
        type: "INTEREST_PAYMENT" as const,
        amount: allocation.toInterestPaise,
        label: "Interest",
      },
      {
        type: "PRINCIPAL_REPAYMENT" as const,
        amount: allocation.toPrincipalPaise,
        label: "Principal",
      },
    ];

    for (const posting of postings) {
      if (posting.amount <= 0) continue;
      await postLedger(tx, {
        groupId: input.groupId,
        cycleId: loan.cycleId,
        // A fine collected with a loan repayment is an interest fine.
        entryType: posting.type === "CONTRIBUTION_FINE" ? "INTEREST_FINE" : posting.type,
        amountPaise: posting.amount,
        entryDate: input.paidOn,
        description: `${posting.label} from ${loan.member.displayName}`,
        referenceType: "LoanRepayment",
        referenceId: repayment.id,
      });
    }

    const receipt = await issueReceipt(tx, {
      groupId: input.groupId,
      cycleId: loan.cycleId,
      memberId: loan.memberId,
      loanId: loan.id,
      repaymentId: repayment.id,
      receiptType: "REPAYMENT",
      amountPaise: input.amountPaise,
      issuedAt: input.paidOn,
    });

    const whatsappText = buildReceiptText({
      groupName: loan.cycle.group.name,
      receiptNo: receipt.receiptNo,
      memberName: loan.member.displayName,
      issuedAt: input.paidOn,
      lines: postings.map((p) => ({ label: p.label, amountPaise: p.amount })),
      totalPaise: input.amountPaise,
      footer: `Principal still due: ${atLeastZero(principalNowOwed) / 100}\nPowered by BhishiBook`,
    });

    await tx.receipt.update({ where: { id: receipt.id }, data: { whatsappText } });

    await writeAudit(tx, {
      groupId: input.groupId,
      actorUserId: input.actorUserId,
      action: "RECORD_LOAN_REPAYMENT",
      entityType: "LoanRepayment",
      entityId: repayment.id,
      newValue: {
        loanId: loan.id,
        ...allocation,
        principalRemaining: atLeastZero(principalNowOwed),
        receiptNo: receipt.receiptNo,
      },
    });

    return { repayment, allocation, receiptNo: receipt.receiptNo, whatsappText };
  });
}
