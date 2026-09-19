import "server-only";
import { buildDistribution, type DistributionMember } from "@/lib/finance";
import {
  atLeastZero,
  decimalToPaise,
  paiseToDecimalString,
  sumPaise,
  type Paise,
} from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { buildReceiptText } from "@/lib/receipt-text";
import { issueReceipt, postLedger, writeAudit } from "./ledger";

/**
 * End of cycle settlement.
 *
 * The rules, as agreed: everyone shares including borrowers, the split is by
 * shares, the base is configurable between interest-only and corpus plus
 * interest, and fines are shared by default but can be kept in the corpus.
 *
 * Preview and commit run the exact same calculation. The preview is what the
 * group looks at before voting; the commit stores that same result. If they
 * could drift apart the group would be shown one number and paid another.
 */

export type DistributionPreview = {
  cycleId: string;
  cycleName: string;
  isClosed: boolean;
  base: "INTEREST_ONLY" | "CORPUS_PLUS_INTEREST";
  distributeFines: boolean;
  interestCollectedPaise: Paise;
  finesCollectedPaise: Paise;
  distributablePaise: Paise;
  retainedInCorpusPaise: Paise;
  totalShares: number;
  totalPayoutPaise: Paise;
  rows: Array<{
    memberId: string;
    displayName: string;
    displayNameMr?: string | null;
    shareCount: number;
    corpusContributedPaise: Paise;
    interestSharePaise: Paise;
    fineSharePaise: Paise;
    corpusReturnedPaise: Paise;
    deductionsPaise: Paise;
    payoutPaise: Paise;
    excluded: boolean;
  }>;
};

export async function previewDistribution(
  groupId: string,
  cycleId?: string
): Promise<DistributionPreview | null> {
  const cycle = await prisma.cycle.findFirst({
    where: { groupId, ...(cycleId ? { id: cycleId } : {}) },
    orderBy: { startsOn: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      distributionBase: true,
      distributeFines: true,
    },
  });

  if (!cycle) return null;

  const [members, repayments, fines] = await Promise.all([
    prisma.groupMember.findMany({
      where: { groupId, status: { not: "INACTIVE" } },
      orderBy: { displayName: "asc" },
      select: {
        id: true,
        displayName: true,
        displayNameMr: true,
        shareCount: true,
        status: true,
        defaultDecision: true,
        contributions: {
          where: { cycleId: cycle.id },
          select: { amountDue: true, amountPaid: true },
        },
        interestDues: {
          where: { cycleId: cycle.id },
          select: { amountDue: true, amountPaid: true },
        },
        fines: {
          where: { cycleId: cycle.id },
          select: { amount: true, amountPaid: true, waivedAmount: true },
        },
        loans: {
          where: { cycleId: cycle.id },
          select: { principal: true, repayments: { select: { principalAmount: true } } },
        },
      },
    }),
    // Interest actually received is what there is to share, not interest billed.
    prisma.loanRepayment.aggregate({
      where: { loan: { cycleId: cycle.id } },
      _sum: { interestAmount: true },
    }),
    prisma.fine.aggregate({
      where: { cycleId: cycle.id },
      _sum: { amountPaid: true },
    }),
  ]);

  const distributionMembers: DistributionMember[] = members.map((member) => {
    const contributed = sumPaise(
      member.contributions.map((row) => decimalToPaise(row.amountPaid))
    );

    const haftaOwed = sumPaise(
      member.contributions.map((row) =>
        atLeastZero(decimalToPaise(row.amountDue) - decimalToPaise(row.amountPaid))
      )
    );
    const interestOwed = sumPaise(
      member.interestDues.map((row) =>
        atLeastZero(decimalToPaise(row.amountDue) - decimalToPaise(row.amountPaid))
      )
    );
    const finesOwed = sumPaise(
      member.fines.map((row) =>
        atLeastZero(
          decimalToPaise(row.amount) -
            decimalToPaise(row.amountPaid) -
            decimalToPaise(row.waivedAmount)
        )
      )
    );
    const principalOwed = sumPaise(
      member.loans.map((loan) =>
        atLeastZero(
          decimalToPaise(loan.principal) -
            sumPaise(loan.repayments.map((r) => decimalToPaise(r.principalAmount)))
        )
      )
    );

    return {
      memberId: member.id,
      displayName: member.displayName,
      shareCount: member.shareCount,
      corpusContributedPaise: contributed,
      outstandingDuesPaise: haftaOwed + interestOwed + finesOwed + principalOwed,
      // A member the group voted to pay nothing still counts for shares, so
      // excluding them does not quietly inflate everyone else's slice.
      excludeFromPayout:
        member.status === "DEFAULTED" && member.defaultDecision === "RETURN_NONE",
    };
  });

  const result = buildDistribution(
    distributionMembers,
    {
      interestCollectedPaise: decimalToPaise(repayments._sum.interestAmount),
      finesCollectedPaise: decimalToPaise(fines._sum.amountPaid),
    },
    { base: cycle.distributionBase, distributeFines: cycle.distributeFines }
  );

  return {
    cycleId: cycle.id,
    cycleName: cycle.name,
    isClosed: cycle.status === "CLOSED",
    base: cycle.distributionBase,
    distributeFines: cycle.distributeFines,
    interestCollectedPaise: decimalToPaise(repayments._sum.interestAmount),
    finesCollectedPaise: decimalToPaise(fines._sum.amountPaid),
    distributablePaise: result.distributablePaise,
    retainedInCorpusPaise: result.retainedInCorpusPaise,
    totalShares: result.totalShares,
    totalPayoutPaise: result.totalPayoutPaise,
    rows: result.settlements.map((settlement) => {
      const member = members.find((m) => m.id === settlement.memberId);
      return {
        ...settlement,
        displayNameMr: member?.displayNameMr,
        excluded:
          distributionMembers.find((m) => m.memberId === settlement.memberId)
            ?.excludeFromPayout ?? false,
      };
    }),
  };
}

/**
 * Commit the settlement and close the cycle.
 *
 * Writes a FinalDistribution row per member, a DISTRIBUTION ledger entry and
 * receipt for each payout, and flips the cycle to CLOSED. Refuses to run twice.
 */
export async function closeCycleWithDistribution(input: {
  groupId: string;
  cycleId: string;
  actorUserId?: string | null;
  closedOn?: Date;
}) {
  const closedOn = input.closedOn ?? new Date();
  const preview = await previewDistribution(input.groupId, input.cycleId);

  if (!preview) throw new Error("That cycle could not be found");
  if (preview.isClosed) throw new Error("This cycle is already closed");
  if (preview.rows.length === 0) throw new Error("This cycle has no members to distribute to");

  return prisma.$transaction(
    async (tx) => {
      const group = await tx.group.findUniqueOrThrow({
        where: { id: input.groupId },
        select: { name: true },
      });

      const existing = await tx.finalDistribution.count({ where: { cycleId: input.cycleId } });
      if (existing > 0) throw new Error("This cycle has already been distributed");

      for (const row of preview.rows) {
        const distribution = await tx.finalDistribution.create({
          data: {
            cycleId: input.cycleId,
            memberId: row.memberId,
            shareCount: row.shareCount,
            corpusContributed: paiseToDecimalString(row.corpusContributedPaise),
            interestShare: paiseToDecimalString(row.interestSharePaise),
            fineShare: paiseToDecimalString(row.fineSharePaise),
            corpusReturned: paiseToDecimalString(row.corpusReturnedPaise),
            deductions: paiseToDecimalString(row.deductionsPaise),
            payoutAmount: paiseToDecimalString(row.payoutPaise),
            notes: row.excluded ? "Excluded by group decision" : null,
          },
        });

        if (row.payoutPaise <= 0) continue;

        await postLedger(tx, {
          groupId: input.groupId,
          cycleId: input.cycleId,
          entryType: "DISTRIBUTION",
          amountPaise: row.payoutPaise,
          entryDate: closedOn,
          description: `Final distribution to ${row.displayName}`,
          referenceType: "FinalDistribution",
          referenceId: distribution.id,
        });

        const receipt = await issueReceipt(tx, {
          groupId: input.groupId,
          cycleId: input.cycleId,
          memberId: row.memberId,
          distributionId: distribution.id,
          receiptType: "DISTRIBUTION",
          amountPaise: row.payoutPaise,
          issuedAt: closedOn,
        });

        const whatsappText = buildReceiptText({
          groupName: group.name,
          receiptNo: receipt.receiptNo,
          memberName: row.displayName,
          issuedAt: closedOn,
          lines: [
            { label: "Interest share", amountPaise: row.interestSharePaise },
            { label: "Fine share", amountPaise: row.fineSharePaise },
            { label: "Corpus returned", amountPaise: row.corpusReturnedPaise },
            { label: "Less dues", amountPaise: row.deductionsPaise },
          ],
          totalPaise: row.payoutPaise,
          footer: `${preview.cycleName} final settlement for ${row.shareCount} share(s).\nPowered by BhishiBook`,
        });

        await tx.receipt.update({ where: { id: receipt.id }, data: { whatsappText } });
      }

      await tx.cycle.update({
        where: { id: input.cycleId },
        data: { status: "CLOSED", closedAt: closedOn },
      });

      await writeAudit(tx, {
        groupId: input.groupId,
        actorUserId: input.actorUserId,
        action: "CLOSE_CYCLE_WITH_DISTRIBUTION",
        entityType: "Cycle",
        entityId: input.cycleId,
        newValue: {
          distributable: preview.distributablePaise,
          totalPayout: preview.totalPayoutPaise,
          members: preview.rows.length,
          base: preview.base,
        },
      });

      return {
        members: preview.rows.length,
        totalPayoutPaise: preview.totalPayoutPaise,
      };
    },
    { timeout: 30_000 }
  );
}
