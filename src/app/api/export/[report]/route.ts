import { NextResponse } from "next/server";
import { requireGroupAdmin } from "@/lib/auth";
import { csvFilename, toCsv } from "@/lib/csv";
import { formatYearMonth } from "@/lib/finance";
import { atLeastZero, decimalToPaise, sumPaise } from "@/lib/money";
import { prisma } from "@/lib/prisma";

/**
 * Backup and reporting exports.
 *
 * Amounts are written as plain decimal numbers, not formatted currency, so
 * they arrive in the spreadsheet as numbers a group can total and check.
 */

const REPORTS = ["members", "contributions", "loans", "fines", "ledger", "receipts"] as const;
type Report = (typeof REPORTS)[number];

const rupees = (paise: number) => (paise / 100).toFixed(2);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ report: string }> }
) {
  const { report } = await params;
  if (!REPORTS.includes(report as Report)) {
    return new NextResponse("Unknown report", { status: 404 });
  }

  // requireGroupAdmin redirects rather than throwing when not allowed, which
  // is the right behaviour for a link the admin clicked.
  const scope = await requireGroupAdmin();

  const group = await prisma.group.findUniqueOrThrow({
    where: { id: scope.groupId },
    select: { name: true },
  });

  const csv = await buildReport(report as Report, scope.groupId);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename(group.name, report)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

async function buildReport(report: Report, groupId: string): Promise<string> {
  if (report === "members") {
    const members = await prisma.groupMember.findMany({
      where: { groupId },
      orderBy: { displayName: "asc" },
      select: {
        displayName: true,
        phone: true,
        email: true,
        shareCount: true,
        monthlyHafta: true,
        status: true,
        defaultDecision: true,
        joinedAt: true,
        contributions: { select: { amountPaid: true } },
      },
    });

    return toCsv(
      ["Name", "Phone", "Email", "Shares", "Monthly hafta", "Paid in", "Status", "Year end decision", "Joined"],
      members.map((member) => [
        member.displayName,
        member.phone,
        member.email,
        member.shareCount,
        rupees(decimalToPaise(member.monthlyHafta)),
        rupees(sumPaise(member.contributions.map((row) => decimalToPaise(row.amountPaid)))),
        member.status,
        member.defaultDecision,
        member.joinedAt,
      ])
    );
  }

  if (report === "contributions") {
    const rows = await prisma.contribution.findMany({
      where: { cycle: { groupId } },
      orderBy: [{ year: "asc" }, { month: "asc" }, { member: { displayName: "asc" } }],
      select: {
        year: true,
        month: true,
        amountDue: true,
        amountPaid: true,
        paidOn: true,
        member: { select: { displayName: true } },
        fines: { select: { amount: true, amountPaid: true, waivedAmount: true, daysLate: true } },
      },
    });

    return toCsv(
      ["Month", "Member", "Due", "Paid", "Outstanding", "Paid on", "Days late", "Fine", "Fine outstanding"],
      rows.map((row) => {
        const due = decimalToPaise(row.amountDue);
        const paid = decimalToPaise(row.amountPaid);
        const fine = row.fines[0];
        const fineAmount = fine ? decimalToPaise(fine.amount) : 0;
        const fineLeft = fine
          ? atLeastZero(
              fineAmount - decimalToPaise(fine.amountPaid) - decimalToPaise(fine.waivedAmount)
            )
          : 0;
        return [
          formatYearMonth({ year: row.year, month: row.month }),
          row.member.displayName,
          rupees(due),
          rupees(paid),
          rupees(atLeastZero(due - paid)),
          row.paidOn,
          fine?.daysLate ?? 0,
          rupees(fineAmount),
          rupees(fineLeft),
        ];
      })
    );
  }

  if (report === "loans") {
    const loans = await prisma.loan.findMany({
      where: { cycle: { groupId } },
      orderBy: { disbursedOn: "asc" },
      select: {
        principal: true,
        interestRate: true,
        disbursedOn: true,
        dueOn: true,
        status: true,
        member: { select: { displayName: true } },
        repayments: { select: { principalAmount: true, interestAmount: true } },
        interestDues: { select: { amountDue: true, amountPaid: true } },
      },
    });

    return toCsv(
      ["Member", "Principal", "Rate %", "Disbursed", "Due by", "Principal repaid", "Interest billed", "Interest paid", "Outstanding principal", "Status"],
      loans.map((loan) => {
        const principal = decimalToPaise(loan.principal);
        const repaid = sumPaise(loan.repayments.map((r) => decimalToPaise(r.principalAmount)));
        return [
          loan.member.displayName,
          rupees(principal),
          loan.interestRate.toFixed(2),
          loan.disbursedOn,
          loan.dueOn,
          rupees(repaid),
          rupees(sumPaise(loan.interestDues.map((d) => decimalToPaise(d.amountDue)))),
          rupees(sumPaise(loan.interestDues.map((d) => decimalToPaise(d.amountPaid)))),
          rupees(atLeastZero(principal - repaid)),
          loan.status,
        ];
      })
    );
  }

  if (report === "fines") {
    const fines = await prisma.fine.findMany({
      where: { cycle: { groupId } },
      orderBy: [{ year: "asc" }, { month: "asc" }],
      select: {
        year: true,
        month: true,
        fineType: true,
        daysLate: true,
        amount: true,
        amountPaid: true,
        waivedAmount: true,
        notes: true,
        member: { select: { displayName: true } },
      },
    });

    return toCsv(
      ["Month", "Member", "Type", "Days late", "Amount", "Paid", "Waived", "Outstanding", "Notes"],
      fines.map((fine) => {
        const amount = decimalToPaise(fine.amount);
        const paid = decimalToPaise(fine.amountPaid);
        const waived = decimalToPaise(fine.waivedAmount);
        return [
          formatYearMonth({ year: fine.year, month: fine.month }),
          fine.member.displayName,
          fine.fineType,
          fine.daysLate,
          rupees(amount),
          rupees(paid),
          rupees(waived),
          rupees(atLeastZero(amount - paid - waived)),
          fine.notes,
        ];
      })
    );
  }

  if (report === "ledger") {
    const entries = await prisma.ledgerEntry.findMany({
      where: { groupId },
      orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
      select: {
        entryDate: true,
        entryType: true,
        amount: true,
        description: true,
        referenceType: true,
        reversalOfId: true,
      },
    });

    return toCsv(
      ["Date", "Type", "Amount", "Description", "Reference", "Is reversal"],
      entries.map((entry) => [
        entry.entryDate,
        entry.entryType,
        rupees(decimalToPaise(entry.amount)),
        entry.description,
        entry.referenceType,
        entry.reversalOfId ? "yes" : "no",
      ])
    );
  }

  const receipts = await prisma.receipt.findMany({
    where: { groupId },
    orderBy: { issuedAt: "asc" },
    select: {
      receiptNo: true,
      receiptType: true,
      amount: true,
      issuedAt: true,
      member: { select: { displayName: true } },
    },
  });

  return toCsv(
    ["Receipt no", "Date", "Member", "Type", "Amount"],
    receipts.map((receipt) => [
      receipt.receiptNo,
      receipt.issuedAt,
      receipt.member?.displayName ?? "",
      receipt.receiptType,
      rupees(decimalToPaise(receipt.amount)),
    ])
  );
}
