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
  formatPaise,
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
export async function availableFundsPaise(tx: Tx, groupId: string): Promise<Paise> {
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

export async function getGroupAvailableFunds(groupId: string): Promise<Paise> {
  return availableFundsPaise(prisma, groupId);
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
      select: { maxLoanCorpusMultiple: true, maxLoanAmount: true },
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

  const maxLoanAmountCap = cycle?.maxLoanAmount ? decimalToPaise(cycle.maxLoanAmount) : 0;
  const effectiveMaxLoanPaise =
    maxLoanAmountCap > 0 ? maxLoanAmountCap : check.maxLoanPaise;
  const effectiveAvailablePaise = Math.max(0, effectiveMaxLoanPaise - outstanding);

  return {
    corpusContributedPaise: contributed,
    maxLoanPaise: effectiveMaxLoanPaise,
    availableToBorrowPaise: effectiveAvailablePaise,
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
        maxLoanAmount: true,
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

    // Rule: Member can only have 1 active loan at a time.
    // If they clear it, they can take a new loan again.
    const activeLoan = await tx.loan.findFirst({
      where: {
        memberId: member.id,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    if (activeLoan) {
      throw new Error(
        `${member.displayName} यांचे आधीचे कर्ज अद्याप सुरू आहे (Active). एकावेळी एकच कर्ज घेता येते, ते पूर्ण फेडल्यावरच (Clear केल्यावर) नवीन कर्ज घेता येईल / Member already has an active loan. Previous loan must be cleared before taking a new loan.`
      );
    }

    const [contributed, outstanding, funds] = await Promise.all([
      corpusContributedPaise(tx, member.id),
      outstandingPrincipalPaise(tx, member.id),
      availableFundsPaise(tx, input.groupId),
    ]);

    const multiple = Number(cycle.maxLoanCorpusMultiple.toFixed(2)) || 3;
    const maxLoanPaiseCap = decimalToPaise(cycle.maxLoanAmount);
    const maxAllowedPaise =
      maxLoanPaiseCap > 0 ? maxLoanPaiseCap : Math.floor(contributed * multiple);

    if (input.principalPaise > maxAllowedPaise) {
      if (maxLoanPaiseCap > 0) {
        throw new Error(
          `कमाल कर्ज मर्यादा ₹${Number(cycle.maxLoanAmount).toLocaleString("en-IN")} आहे. त्यापेक्षा जास्त कर्ज घेता येणार नाही / Requested loan exceeds maximum allowed loan limit of ₹${Number(cycle.maxLoanAmount).toLocaleString("en-IN")}.`
        );
      } else {
        throw new Error(
          `कमाल कर्ज मर्यादा सेट नसल्यामुळे जमा रक्कमेच्या ${multiple} पट (₹${(maxAllowedPaise / 100).toLocaleString("en-IN")}) पर्यंतच कर्ज घेता येईल / Requested loan exceeds ${multiple}x of contributed savings.`
        );
      }
    }

    if (input.principalPaise > funds) {
      throw new Error(
        `संस्थेच्या तिजोरीत पुरेसा निधी उपलब्ध नाही. उपलब्ध निधी: ₹${(funds / 100).toLocaleString("en-IN")} / Insufficient funds in treasury.`
      );
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
        `This loan only owes ${formatPaise(owedFine + owedInterest + owedPrincipal, {
          whole: true,
        })}. Reduce the amount.`
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

    const isPureInterest =
      (allocation.toInterestPaise > 0 || allocation.toFinePaise > 0) &&
      allocation.toPrincipalPaise === 0;

    const receipt = await issueReceipt(tx, {
      groupId: input.groupId,
      cycleId: loan.cycleId,
      memberId: loan.memberId,
      loanId: loan.id,
      repaymentId: repayment.id,
      receiptType: isPureInterest ? "INTEREST" : "REPAYMENT",
      amountPaise: input.amountPaise,
      issuedAt: input.paidOn,
    });

    const receiptLabel = isPureInterest
      ? "कर्ज व्याज (Loan Interest)"
      : "कर्ज परतफेड (Loan Repayment)";

    const whatsappText = buildReceiptText({
      groupName: loan.cycle.group.name,
      receiptNo: receipt.receiptNo,
      memberName: loan.member.displayName,
      issuedAt: input.paidOn,
      lines: postings.map((p) => ({
        label:
          p.type === "INTEREST_PAYMENT"
            ? "कर्ज व्याज (Interest)"
            : p.type === "CONTRIBUTION_FINE"
            ? "दंड (Fine)"
            : "मुद्दल (Principal)",
        amountPaise: p.amount,
      })),
      totalPaise: input.amountPaise,
      footer: `प्रकार: ${receiptLabel}\nशिल्लक मुद्दल: ${formatPaise(
        atLeastZero(principalNowOwed),
        { whole: true }
      )}\nPowered by BhishiBook`,
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

export async function updateLoan(input: {
  groupId: string;
  loanId: string;
  principalPaise: Paise;
  interestRate?: string;
  disbursedOn: Date;
  notes?: string;
  actorUserId?: string | null;
}) {
  if (input.principalPaise <= 0) throw new Error("Loan amount must be greater than zero");

  return prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findFirstOrThrow({
      where: { id: input.loanId, cycle: { groupId: input.groupId } },
      include: {
        cycle: { include: { group: true } },
        member: true,
        repayments: true,
      },
    });

    const totalRepaidPaise = sumPaise(
      loan.repayments.map((r) => decimalToPaise(r.principalAmount))
    );
    if (input.principalPaise < totalRepaidPaise) {
      throw new Error(
        `मुद्दल आधी परतफेड केलेल्या रकमेपेक्षा (₹${(totalRepaidPaise / 100).toLocaleString()}) कमी करता येणार नाही.`
      );
    }

    const rate = input.interestRate ? Number(input.interestRate) : Number(loan.interestRate);
    if (rate < 0 || rate > 100) throw new Error("Interest rate must be between 0 and 100%");

    const dueOn = new Date(input.disbursedOn);
    dueOn.setUTCMonth(dueOn.getUTCMonth() + loan.cycle.maxRepaymentMonths);

    const updated = await tx.loan.update({
      where: { id: loan.id },
      data: {
        principal: paiseToDecimalString(input.principalPaise),
        interestRate: rate,
        disbursedOn: input.disbursedOn,
        dueOn,
        notes: input.notes?.trim() || null,
      },
    });

    // Update disbursement ledger entry
    await tx.ledgerEntry.updateMany({
      where: { referenceId: loan.id, referenceType: "Loan", entryType: "LOAN_DISBURSEMENT" },
      data: {
        amount: paiseToDecimalString(input.principalPaise),
        entryDate: input.disbursedOn,
      },
    });

    // Update disbursement receipt
    const existingReceipt = await tx.receipt.findFirst({
      where: { loanId: loan.id, receiptType: "LOAN" },
      select: { receiptNo: true },
    });

    const whatsappText = buildReceiptText({
      groupName: loan.cycle.group.name,
      receiptNo: existingReceipt?.receiptNo ?? "REC-LOAN",
      memberName: loan.member.displayNameMr || loan.member.displayName,
      issuedAt: input.disbursedOn,
      lines: [{ label: "Loan disbursed", amountPaise: input.principalPaise }],
      totalPaise: input.principalPaise,
      footer: `Interest ${rate.toFixed(2)}% per month. Principal due by ${dueOn.toISOString().slice(0, 10)}.\nPowered by BhishiBook`,
    });

    await tx.receipt.updateMany({
      where: { loanId: loan.id, receiptType: "LOAN" },
      data: {
        amount: paiseToDecimalString(input.principalPaise),
        issuedAt: input.disbursedOn,
        whatsappText,
      },
    });

    // Recalculate all unpaid interest dues for this loan
    const newMonthlyInterestPaise = monthlyInterest({
      principalPaise: input.principalPaise,
      monthlyInterestRate: rate.toFixed(2),
    });

    await tx.interestDue.updateMany({
      where: { loanId: loan.id, amountPaid: 0 },
      data: {
        amountDue: paiseToDecimalString(newMonthlyInterestPaise),
      },
    });

    await writeAudit(tx, {
      groupId: input.groupId,
      actorUserId: input.actorUserId,
      action: "UPDATE_LOAN",
      entityType: "Loan",
      entityId: loan.id,
      oldValue: {
        principal: decimalToPaise(loan.principal),
        rate: loan.interestRate.toFixed(2),
        disbursedOn: loan.disbursedOn.toISOString(),
      },
      newValue: {
        principal: input.principalPaise,
        rate: rate.toFixed(2),
        disbursedOn: input.disbursedOn.toISOString(),
      },
    });

    return updated;
  });
}

export async function deleteLoan(input: {
  groupId: string;
  loanId: string;
  actorUserId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findFirstOrThrow({
      where: { id: input.loanId, cycle: { groupId: input.groupId } },
      include: {
        repayments: true,
        member: true,
      },
    });

    if (loan.repayments.length > 0) {
      throw new Error(
        "या कर्जावर आधीच परतफेड जमा झालेली आहे. कर्ज हटवण्यासाठी प्रथम परतफेड तपासा/हटवा (Cannot delete loan with repayments)."
      );
    }

    // 1. Delete unpaid interest dues
    await tx.interestDue.deleteMany({ where: { loanId: loan.id } });

    // 2. Delete attached fines
    await tx.fine.deleteMany({ where: { loanId: loan.id } });

    // 3. Delete attached receipts
    await tx.receipt.deleteMany({ where: { loanId: loan.id } });

    // 4. Delete disbursement ledger entry
    await tx.ledgerEntry.deleteMany({
      where: { referenceId: loan.id, referenceType: "Loan" },
    });

    // 5. Unlink loan application if any
    await tx.loanApplication.updateMany({
      where: { disbursedLoanId: loan.id },
      data: { disbursedLoanId: null, status: "READY_FOR_DISBURSEMENT" },
    });

    // 6. Delete loan
    await tx.loan.delete({ where: { id: loan.id } });

    await writeAudit(tx, {
      groupId: input.groupId,
      actorUserId: input.actorUserId,
      action: "DELETE_LOAN",
      entityType: "Loan",
      entityId: loan.id,
      oldValue: {
        member: loan.member.displayName,
        principal: decimalToPaise(loan.principal),
        disbursedOn: loan.disbursedOn.toISOString(),
      },
    });

    return { success: true, memberName: loan.member.displayName };
  });
}

