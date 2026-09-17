import "server-only";
import type { LedgerEntryType, Prisma, ReceiptType } from "@prisma/client";
import { paiseToDecimalString, type Paise } from "@/lib/money";

/**
 * The ledger is the spine of the app.
 *
 * Two rules the group agreed on are enforced here rather than left to each
 * caller to remember:
 *
 *   1. Every movement of money gets a ledger entry.
 *   2. Nothing financial is ever deleted. A mistake is undone by posting a
 *      REVERSAL that points at the original entry, so the history stays
 *      readable and the totals still add up.
 *
 * Everything in this file takes a transaction client, so a payment, its
 * ledger entry, its receipt, and its audit row either all land or none do.
 */

export type Tx = Prisma.TransactionClient;

export type LedgerPosting = {
  groupId: string;
  cycleId?: string | null;
  entryType: LedgerEntryType;
  amountPaise: Paise;
  entryDate: Date;
  description: string;
  referenceType?: string;
  referenceId?: string;
};

export async function postLedger(tx: Tx, posting: LedgerPosting) {
  return tx.ledgerEntry.create({
    data: {
      groupId: posting.groupId,
      cycleId: posting.cycleId ?? null,
      entryType: posting.entryType,
      amount: paiseToDecimalString(posting.amountPaise),
      entryDate: posting.entryDate,
      description: posting.description,
      referenceType: posting.referenceType ?? null,
      referenceId: posting.referenceId ?? null,
    },
  });
}

/**
 * Undo a posting without deleting it.
 * The reversal carries the same amount and points back at what it cancels.
 */
export async function reverseLedgerEntry(
  tx: Tx,
  entryId: string,
  reason: string,
  onDate = new Date()
) {
  const original = await tx.ledgerEntry.findUniqueOrThrow({ where: { id: entryId } });

  if (original.reversalOfId) {
    throw new Error("That entry is itself a reversal and cannot be reversed again");
  }
  const existing = await tx.ledgerEntry.findFirst({ where: { reversalOfId: entryId } });
  if (existing) throw new Error("That entry has already been reversed");

  return tx.ledgerEntry.create({
    data: {
      groupId: original.groupId,
      cycleId: original.cycleId,
      entryType: "REVERSAL",
      amount: original.amount,
      entryDate: onDate,
      description: `Reversal: ${reason}`,
      referenceType: original.referenceType,
      referenceId: original.referenceId,
      reversalOfId: original.id,
    },
  });
}

/**
 * Mint the next receipt number for a group.
 *
 * The counter is incremented inside the caller's transaction, which takes a
 * row lock, so two admins recording a payment at the same moment cannot be
 * handed the same number. That matters because receiptNo is unique per group
 * and a collision would fail the whole payment.
 */
export async function nextReceiptNumber(tx: Tx, groupId: string): Promise<string> {
  const counter = await tx.receiptCounter.upsert({
    where: { groupId },
    create: { groupId, nextNumber: 2 },
    update: { nextNumber: { increment: 1 } },
    select: { nextNumber: true },
  });

  // upsert returns the value AFTER the increment, so the number just used is
  // one less. On the create path that is 2 - 1 = 1, the first receipt.
  return String(counter.nextNumber - 1).padStart(6, "0");
}

export type ReceiptInput = {
  groupId: string;
  cycleId?: string | null;
  memberId?: string | null;
  contributionId?: string | null;
  loanId?: string | null;
  repaymentId?: string | null;
  fineId?: string | null;
  distributionId?: string | null;
  receiptType: ReceiptType;
  amountPaise: Paise;
  issuedAt?: Date;
  whatsappText?: string;
};

export async function issueReceipt(tx: Tx, input: ReceiptInput) {
  const receiptNo = await nextReceiptNumber(tx, input.groupId);

  return tx.receipt.create({
    data: {
      groupId: input.groupId,
      cycleId: input.cycleId ?? null,
      memberId: input.memberId ?? null,
      contributionId: input.contributionId ?? null,
      loanId: input.loanId ?? null,
      repaymentId: input.repaymentId ?? null,
      fineId: input.fineId ?? null,
      distributionId: input.distributionId ?? null,
      receiptNo,
      receiptType: input.receiptType,
      amount: paiseToDecimalString(input.amountPaise),
      issuedAt: input.issuedAt ?? new Date(),
      whatsappText: input.whatsappText ?? null,
    },
  });
}

export type AuditInput = {
  groupId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
};

export async function writeAudit(tx: Tx, input: AuditInput) {
  return tx.auditLog.create({
    data: {
      groupId: input.groupId ?? null,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      ...(input.oldValue === undefined ? {} : { oldValue: input.oldValue }),
      ...(input.newValue === undefined ? {} : { newValue: input.newValue }),
    },
  });
}

/**
 * Refuse to touch a month the group has already reviewed and locked.
 * Called by every write that lands in a specific month.
 */
export async function assertPeriodOpen(
  tx: Tx,
  cycleId: string,
  year: number,
  month: number
): Promise<void> {
  const lock = await tx.periodLock.findUnique({
    where: { cycleId_month_year: { cycleId, month, year } },
    select: { lockedAt: true },
  });
  if (lock) {
    throw new Error(
      `${String(month).padStart(2, "0")}/${year} is closed and locked. Reopen the month to make changes.`
    );
  }
}
