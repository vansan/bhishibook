import "server-only";
import { prisma } from "@/lib/prisma";
import { decimalToPaise, sumPaise, type Paise } from "@/lib/money";
import { formatYearMonth, maxLoanFor, yearMonthKey, yearMonthOf } from "@/lib/finance";

/**
 * Read models for the dashboards.
 *
 * Two rules hold everywhere in this file:
 *
 *  1. Every query is scoped by groupId. The caller gets that id from
 *     requireGroupScope, never from the client, which is what keeps one
 *     group's money invisible to another.
 *  2. Errors are not swallowed. The previous version wrapped these in
 *     `catch { return null }` and silently fell back to hardcoded demo
 *     figures, so a database outage looked like real data. A financial
 *     dashboard must fail loudly instead.
 */

export type PlatformOverview = {
  groupCount: number;
  activeGroupCount: number;
  freeGroupCount: number;
  memberCount: number;
  corpusPaise: Paise;
};

export async function getPlatformOverview(): Promise<PlatformOverview> {
  const [groupCount, activeGroupCount, freeGroupCount, memberCount, contributions] =
    await Promise.all([
      prisma.group.count(),
      prisma.group.count({ where: { status: "ACTIVE" } }),
      prisma.group.count({ where: { planStatus: "FREE" } }),
      prisma.groupMember.count(),
      prisma.contribution.aggregate({ _sum: { amountPaid: true } }),
    ]);

  return {
    groupCount,
    activeGroupCount,
    freeGroupCount,
    memberCount,
    corpusPaise: decimalToPaise(contributions._sum.amountPaid),
  };
}

export type GroupOverview = {
  groupId: string;
  groupName: string;
  memberCount: number;
  totalShares: number;
  /** What a full month of hafta should bring in. */
  monthlyExpectedPaise: Paise;
  /** Hafta actually received for the current calendar month. */
  collectedThisMonthPaise: Paise;
  /** Every rupee of hafta received across the cycle. */
  corpusCollectedPaise: Paise;
  outstandingPrincipalPaise: Paise;
  interestCollectedPaise: Paise;
  finesOutstandingPaise: Paise;
  activeLoanCount: number;
  availableFundsPaise: Paise;
  cycle: {
    id: string;
    name: string;
    contributionDueDay: number;
    monthlyInterestRate: string;
    maxRepaymentMonths: number;
    maxLoanCorpusMultiple: string;
    distributionBase: string;
    distributeFines: boolean;
    status: string;
  } | null;
};

export async function getGroupOverview(
  groupId: string,
  asOf = new Date()
): Promise<GroupOverview | null> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      cycles: {
        orderBy: { startsOn: "desc" },
        take: 1,
        select: {
          id: true,
          name: true,
          status: true,
          contributionDueDay: true,
          monthlyInterestRate: true,
          maxRepaymentMonths: true,
          maxLoanCorpusMultiple: true,
          distributionBase: true,
          distributeFines: true,
        },
      },
      members: {
        where: { status: { not: "INACTIVE" } },
        select: { shareCount: true, monthlyHafta: true },
      },
    },
  });

  if (!group) return null;

  const cycle = group.cycles[0] ?? null;
  const { year, month } = yearMonthOf(asOf);

  const [thisMonth, allContributions, loans, repayments, fines] = await Promise.all([
    cycle
      ? prisma.contribution.aggregate({
          where: { cycleId: cycle.id, year, month },
          _sum: { amountPaid: true },
        })
      : null,
    cycle
      ? prisma.contribution.aggregate({
          where: { cycleId: cycle.id },
          _sum: { amountPaid: true },
        })
      : null,
    cycle
      ? prisma.loan.findMany({
          where: { cycleId: cycle.id },
          select: { id: true, principal: true, status: true },
        })
      : [],
    cycle
      ? prisma.loanRepayment.aggregate({
          where: { loan: { cycleId: cycle.id } },
          _sum: { principalAmount: true, interestAmount: true },
        })
      : null,
    cycle
      ? prisma.fine.aggregate({
          where: { cycleId: cycle.id },
          _sum: { amount: true, amountPaid: true, waivedAmount: true },
        })
      : null,
  ]);

  const disbursedPaise = sumPaise(loans.map((loan) => decimalToPaise(loan.principal)));
  const principalRepaidPaise = decimalToPaise(repayments?._sum.principalAmount);
  const interestCollectedPaise = decimalToPaise(repayments?._sum.interestAmount);
  const corpusCollectedPaise = decimalToPaise(allContributions?._sum.amountPaid);
  const outstandingPrincipalPaise = Math.max(disbursedPaise - principalRepaidPaise, 0);

  const finesRaisedPaise = decimalToPaise(fines?._sum.amount);
  const finesPaidPaise = decimalToPaise(fines?._sum.amountPaid);
  const finesWaivedPaise = decimalToPaise(fines?._sum.waivedAmount);

  return {
    groupId: group.id,
    groupName: group.name,
    memberCount: group.members.length,
    totalShares: group.members.reduce((total, member) => total + member.shareCount, 0),
    monthlyExpectedPaise: sumPaise(
      group.members.map((member) => decimalToPaise(member.monthlyHafta))
    ),
    collectedThisMonthPaise: decimalToPaise(thisMonth?._sum.amountPaid),
    corpusCollectedPaise,
    outstandingPrincipalPaise,
    interestCollectedPaise,
    finesOutstandingPaise: Math.max(finesRaisedPaise - finesPaidPaise - finesWaivedPaise, 0),
    activeLoanCount: loans.filter((loan) => loan.status === "ACTIVE").length,
    // Cash the group could lend right now: everything collected, less what is
    // still out on loan.
    availableFundsPaise: Math.max(
      corpusCollectedPaise + interestCollectedPaise + finesPaidPaise - outstandingPrincipalPaise,
      0
    ),
    cycle: cycle
      ? {
          id: cycle.id,
          name: cycle.name,
          contributionDueDay: cycle.contributionDueDay,
          monthlyInterestRate: cycle.monthlyInterestRate.toFixed(2),
          maxRepaymentMonths: cycle.maxRepaymentMonths,
          maxLoanCorpusMultiple: cycle.maxLoanCorpusMultiple.toFixed(2),
          distributionBase: cycle.distributionBase,
          distributeFines: cycle.distributeFines,
          status: cycle.status,
        }
      : null,
  };
}

export type MemberSummary = {
  memberId: string;
  displayName: string;
  shareCount: number;
  monthlyHaftaPaise: Paise;
  corpusContributedPaise: Paise;
  haftaOutstandingPaise: Paise;
  outstandingPrincipalPaise: Paise;
  interestOutstandingPaise: Paise;
  finesOutstandingPaise: Paise;
  /** What this member may still borrow, under the cycle's corpus multiple. */
  borrowingHeadroomPaise: Paise;
  activeLoanCount: number;
  receiptCount: number;
};

/**
 * One member's own position. This is what a member sees on their passbook, so
 * it must never widen to the whole group.
 */
export async function getMemberSummary(
  groupId: string,
  memberId: string
): Promise<MemberSummary | null> {
  const member = await prisma.groupMember.findFirst({
    // groupId is part of the filter, not just the id, so a member id from
    // another group cannot be read even if someone guesses one.
    where: { id: memberId, groupId },
    select: {
      id: true,
      displayName: true,
      shareCount: true,
      monthlyHafta: true,
      group: {
        select: {
          cycles: {
            orderBy: { startsOn: "desc" },
            take: 1,
            select: { id: true, maxLoanCorpusMultiple: true },
          },
        },
      },
    },
  });

  if (!member) return null;

  const cycle = member.group.cycles[0] ?? null;

  const [contributions, loans, repayments, interestDues, fines, receiptCount] =
    await Promise.all([
      prisma.contribution.aggregate({
        where: { memberId, ...(cycle ? { cycleId: cycle.id } : {}) },
        _sum: { amountDue: true, amountPaid: true },
      }),
      prisma.loan.findMany({
        where: { memberId, ...(cycle ? { cycleId: cycle.id } : {}) },
        select: { principal: true, status: true },
      }),
      prisma.loanRepayment.aggregate({
        where: { memberId },
        _sum: { principalAmount: true, interestAmount: true },
      }),
      prisma.interestDue.aggregate({
        where: { memberId, ...(cycle ? { cycleId: cycle.id } : {}) },
        _sum: { amountDue: true, amountPaid: true },
      }),
      prisma.fine.aggregate({
        where: { memberId, ...(cycle ? { cycleId: cycle.id } : {}) },
        _sum: { amount: true, amountPaid: true, waivedAmount: true },
      }),
      prisma.receipt.count({ where: { memberId } }),
    ]);

  const corpusContributedPaise = decimalToPaise(contributions._sum.amountPaid);
  const disbursedPaise = sumPaise(loans.map((loan) => decimalToPaise(loan.principal)));
  const outstandingPrincipalPaise = Math.max(
    disbursedPaise - decimalToPaise(repayments._sum.principalAmount),
    0
  );

  const multiple = cycle?.maxLoanCorpusMultiple.toFixed(2) ?? "2.00";
  const maxLoanPaise = maxLoanFor(corpusContributedPaise, multiple);

  return {
    memberId: member.id,
    displayName: member.displayName,
    shareCount: member.shareCount,
    monthlyHaftaPaise: decimalToPaise(member.monthlyHafta),
    corpusContributedPaise,
    haftaOutstandingPaise: Math.max(
      decimalToPaise(contributions._sum.amountDue) - corpusContributedPaise,
      0
    ),
    outstandingPrincipalPaise,
    interestOutstandingPaise: Math.max(
      decimalToPaise(interestDues._sum.amountDue) - decimalToPaise(interestDues._sum.amountPaid),
      0
    ),
    finesOutstandingPaise: Math.max(
      decimalToPaise(fines._sum.amount) -
        decimalToPaise(fines._sum.amountPaid) -
        decimalToPaise(fines._sum.waivedAmount),
      0
    ),
    borrowingHeadroomPaise: Math.max(maxLoanPaise - outstandingPrincipalPaise, 0),
    activeLoanCount: loans.filter((loan) => loan.status === "ACTIVE").length,
    receiptCount,
  };
}

export type PassbookMonth = {
  key: string;
  label: string;
  haftaDuePaise: Paise;
  haftaPaidPaise: Paise;
  interestDuePaise: Paise;
  interestPaidPaise: Paise;
  finePaise: Paise;
  fineOutstandingPaise: Paise;
  settled: boolean;
};

export type PassbookReceipt = {
  id: string;
  receiptNo: string;
  receiptType: string;
  issuedOn: string;
  amountPaise: Paise;
  whatsappText: string | null;
};

/**
 * The member's own month-by-month history plus their receipts.
 * Scoped by groupId and memberId together, same as getMemberSummary.
 */
export async function getMemberPassbook(
  groupId: string,
  memberId: string
): Promise<{ months: PassbookMonth[]; receipts: PassbookReceipt[] }> {
  const member = await prisma.groupMember.findFirst({
    where: { id: memberId, groupId },
    select: { id: true },
  });
  if (!member) return { months: [], receipts: [] };

  const [contributions, interestDues, fines, receipts] = await Promise.all([
    prisma.contribution.findMany({
      where: { memberId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      select: { year: true, month: true, amountDue: true, amountPaid: true },
    }),
    prisma.interestDue.findMany({
      where: { memberId },
      select: { year: true, month: true, amountDue: true, amountPaid: true },
    }),
    prisma.fine.findMany({
      where: { memberId },
      select: { year: true, month: true, amount: true, amountPaid: true, waivedAmount: true },
    }),
    prisma.receipt.findMany({
      where: { memberId },
      orderBy: { issuedAt: "desc" },
      take: 100,
      select: {
        id: true,
        receiptNo: true,
        receiptType: true,
        issuedAt: true,
        amount: true,
        whatsappText: true,
      },
    }),
  ]);

  const byMonth = new Map<string, PassbookMonth>();
  const slot = (year: number, month: number): PassbookMonth => {
    const key = yearMonthKey({ year, month });
    const existing = byMonth.get(key);
    if (existing) return existing;
    const fresh: PassbookMonth = {
      key,
      label: formatYearMonth({ year, month }),
      haftaDuePaise: 0,
      haftaPaidPaise: 0,
      interestDuePaise: 0,
      interestPaidPaise: 0,
      finePaise: 0,
      fineOutstandingPaise: 0,
      settled: false,
    };
    byMonth.set(key, fresh);
    return fresh;
  };

  for (const row of contributions) {
    const entry = slot(row.year, row.month);
    entry.haftaDuePaise += decimalToPaise(row.amountDue);
    entry.haftaPaidPaise += decimalToPaise(row.amountPaid);
  }
  for (const row of interestDues) {
    const entry = slot(row.year, row.month);
    entry.interestDuePaise += decimalToPaise(row.amountDue);
    entry.interestPaidPaise += decimalToPaise(row.amountPaid);
  }
  for (const row of fines) {
    const entry = slot(row.year, row.month);
    entry.finePaise += decimalToPaise(row.amount);
    entry.fineOutstandingPaise += Math.max(
      decimalToPaise(row.amount) -
        decimalToPaise(row.amountPaid) -
        decimalToPaise(row.waivedAmount),
      0
    );
  }

  const months = [...byMonth.values()]
    .map((entry) => ({
      ...entry,
      settled:
        entry.haftaPaidPaise >= entry.haftaDuePaise &&
        entry.interestPaidPaise >= entry.interestDuePaise &&
        entry.fineOutstandingPaise === 0,
    }))
    .sort((a, b) => b.key.localeCompare(a.key));

  return {
    months,
    receipts: receipts.map((receipt) => ({
      id: receipt.id,
      receiptNo: receipt.receiptNo,
      receiptType: receipt.receiptType,
      issuedOn: receipt.issuedAt.toISOString().slice(0, 10),
      amountPaise: decimalToPaise(receipt.amount),
      whatsappText: receipt.whatsappText,
    })),
  };
}
