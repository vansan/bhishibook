import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { decimalToPaise } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { buildReceiptPdf } from "@/lib/receipt-pdf";

/**
 * Downloadable PDF for one receipt.
 *
 * A Route Handler rather than a Server Action, because this returns a file.
 * It repeats the authorisation itself: a receipt id is a URL, and a URL gets
 * shared, so the check cannot live anywhere else.
 *
 * An admin may fetch any receipt in their own group; a member may fetch only
 * their own.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuth();
  if (!auth) return new NextResponse("Not signed in", { status: 401 });

  const { id } = await params;

  const receipt = await prisma.receipt.findUnique({
    where: { id },
    select: {
      id: true,
      groupId: true,
      memberId: true,
      receiptNo: true,
      receiptType: true,
      amount: true,
      issuedAt: true,
      whatsappText: true,
      group: { select: { name: true, platformName: true } },
      member: { select: { displayName: true } },
      contribution: { select: { month: true, year: true } },
      repayment: {
        select: { principalAmount: true, interestAmount: true, fineAmount: true },
      },
      distribution: {
        select: {
          interestShare: true,
          fineShare: true,
          corpusReturned: true,
          deductions: true,
        },
      },
    },
  });

  if (!receipt) return new NextResponse("Not found", { status: 404 });

  const sameGroup = auth.role === "SUPER_ADMIN" || receipt.groupId === auth.groupId;
  const ownReceipt = receipt.memberId !== null && receipt.memberId === auth.memberId;
  const allowed = auth.role === "MEMBER" ? ownReceipt : sameGroup;
  if (!allowed) return new NextResponse("Not allowed", { status: 403 });

  const total = decimalToPaise(receipt.amount);

  // Break the total down using whatever the receipt is attached to.
  let lines: Array<{ label: string; amountPaise: number }>;
  if (receipt.repayment) {
    lines = [
      { label: "Late fine", amountPaise: decimalToPaise(receipt.repayment.fineAmount) },
      { label: "Interest", amountPaise: decimalToPaise(receipt.repayment.interestAmount) },
      { label: "Principal", amountPaise: decimalToPaise(receipt.repayment.principalAmount) },
    ];
  } else if (receipt.distribution) {
    lines = [
      { label: "Interest share", amountPaise: decimalToPaise(receipt.distribution.interestShare) },
      { label: "Fine share", amountPaise: decimalToPaise(receipt.distribution.fineShare) },
      {
        label: "Corpus returned",
        amountPaise: decimalToPaise(receipt.distribution.corpusReturned),
      },
      { label: "Less dues", amountPaise: decimalToPaise(receipt.distribution.deductions) },
    ];
  } else {
    lines = [{ label: receipt.receiptType, amountPaise: total }];
  }

  const period = receipt.contribution
    ? `For ${String(receipt.contribution.month).padStart(2, "0")}/${receipt.contribution.year}`
    : undefined;

  const pdf = await buildReceiptPdf({
    groupName: receipt.group.name,
    platformName: receipt.group.platformName,
    receiptNo: receipt.receiptNo,
    memberName: receipt.member?.displayName ?? "-",
    receiptType: receipt.receiptType,
    issuedAt: receipt.issuedAt,
    lines,
    totalPaise: total,
    footerNote: period,
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="receipt-${receipt.receiptNo}.pdf"`,
      // A receipt is personal and must never be held by a shared cache.
      "Cache-Control": "private, no-store",
    },
  });
}
