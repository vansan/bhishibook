import { Banknote, CircleDollarSign, ReceiptText, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { requireMemberScope } from "@/lib/auth";
import { getLocale, getMessages } from "@/lib/i18n";
import { formatMemberName } from "@/lib/members";
import { formatPaise } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { whatsappShareUrl } from "@/lib/receipt-text";
import { getGroupOverview, getMemberPassbook, getMemberSummary } from "@/lib/repositories";
import { getGroupLoanApplications } from "@/lib/services/loan-applications";
import { ReceiptActions } from "@/app/group/receipts/receipt-actions";
import { cn } from "@/lib/utils";
import {
  ApplyLoanModal,
  GuarantorRequestsList,
  MemberVotingList,
  MyApplicationsList,
} from "./loan-application-forms";

export default async function MemberPage() {
  const scope = await requireMemberScope();

  const [t, locale, summary, overview, passbook, applications, allMembers] =
    await Promise.all([
      getMessages(),
      getLocale(),
      getMemberSummary(scope.groupId, scope.memberId),
      getGroupOverview(scope.groupId),
      getMemberPassbook(scope.groupId, scope.memberId),
      getGroupLoanApplications(scope.groupId, scope.memberId),
      prisma.groupMember.findMany({
        where: { groupId: scope.groupId, status: "ACTIVE" },
        orderBy: { displayName: "asc" },
        select: { id: true, displayName: true, displayNameMr: true, phone: true },
      }),
    ]);

  if (!summary) notFound();

  const whole = { whole: true } as const;
  const dues =
    summary.haftaOutstandingPaise +
    summary.interestOutstandingPaise +
    summary.finesOutstandingPaise;

  const duesBreakdown = [
    `${t.member.hafta} ${formatPaise(summary.haftaOutstandingPaise, whole)}`,
    `${t.member.interest} ${formatPaise(summary.interestOutstandingPaise, whole)}`,
    `${t.member.fines} ${formatPaise(summary.finesOutstandingPaise, whole)}`,
  ].join(" · ");

  const memberOptions = allMembers.map((m) => ({
    id: m.id,
    name: formatMemberName(m, locale),
    phone: m.phone ?? "",
  }));

  const guarantorRequests = applications.filter(
    (app) =>
      app.currentUserGuarantorStatus !== null &&
      app.currentUserGuarantorStatus !== undefined
  );

  const memberDisplayName = formatMemberName(summary, locale);

  return (
    <AppShell groupName={overview?.groupName}>
      <DashboardPage
        actions={
          <ApplyLoanModal
            currentMemberId={scope.memberId}
            labels={{
              applyBtn: t.loans.apply,
              modalTitle: t.loans.applyTitle,
              amountLabel: t.loans.requestedAmount,
              termLabel: t.loans.termMonths,
              purposeLabel: t.loans.purpose,
              selectJaminLabel: t.loans.selectJamin,
              minJaminHint: t.loans.minJaminRequired,
              submittingLabel: t.loans.submittingApplication,
              close: t.common.close,
            }}
            members={memberOptions}
          />
        }
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <span>{memberDisplayName}</span>
            {summary.isAdmin ? (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-[var(--primary)]">
                {t.common.adminBadge}
              </span>
            ) : null}
          </span>
        }
        stats={[
          {
            label: t.member.myShares,
            value: String(summary.shareCount),
            icon: ShieldCheck,
            hint: `${formatPaise(summary.monthlyHaftaPaise, whole)} ${t.common.perMonth}`,
          },
          {
            label: t.member.paidInSoFar,
            value: formatPaise(summary.corpusContributedPaise, whole),
            icon: Banknote,
          },
          {
            label: t.member.totalDues,
            value: formatPaise(dues, whole),
            icon: CircleDollarSign,
            hint: dues > 0 ? duesBreakdown : t.member.nothingOutstanding,
          },
          {
            label: t.member.receipts,
            value: String(summary.receiptCount),
            icon: ReceiptText,
          },
        ]}
        subtitle={t.member.subtitle}
        title={t.member.title}
      >
        {/* Pending Guarantor (Jamin) Requests */}
        <GuarantorRequestsList
          labels={{
            title: t.loans.guarantors,
            from: t.common.member,
            amount: t.common.amount,
            purpose: t.common.notes,
            accept: t.loans.acceptAsJamin,
            decline: t.loans.declineJamin,
            statusAccepted: t.common.paid,
            statusDeclined: t.loans.rejectLoan,
          }}
          requests={guarantorRequests}
        />

        {/* My Loan Applications */}
        <MyApplicationsList
          applications={applications}
          labels={{
            title: t.loans.applications,
            amount: t.common.amount,
            date: t.common.date,
            status: t.common.status,
            jamin: t.loans.guarantors,
            votes: t.loans.memberApproved,
            pending: t.loans.awaitingApprovals,
            ready: t.loans.readyForDisbursement,
            disbursed: t.loans.disbursedOn,
          }}
        />

        {/* Member Voting on Open Applications */}
        <MemberVotingList
          applications={applications}
          labels={{
            title: `${t.loans.applications} (${t.loans.approvalProgress})`,
            applicant: t.common.member,
            amount: t.common.amount,
            jaminStatus: t.loans.jaminAccepted,
            approvalStatus: t.loans.memberApproved,
            approve: t.loans.approveLoan,
            reject: t.loans.rejectLoan,
            youApproved: t.loans.approveLoan,
            youRejected: t.loans.rejectLoan,
            notVoted: t.loans.awaitingApprovals,
          }}
        />
        <div className="rounded-lg border border-[var(--line)] bg-white p-5">
          <h2 className="text-base font-semibold">{t.member.myLoans}</h2>
          <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Row
              label={t.member.outstandingPrincipal}
              value={formatPaise(summary.outstandingPrincipalPaise, whole)}
            />
            <Row label={t.member.activeLoans} value={String(summary.activeLoanCount)} />
            <Row
              label={t.member.interestOutstanding}
              value={formatPaise(summary.interestOutstandingPaise, whole)}
            />
            <Row
              label={t.member.canStillBorrow}
              value={formatPaise(summary.borrowingHeadroomPaise, whole)}
            />
          </dl>
        </div>

        {passbook.months.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="border-b border-[var(--line)] px-5 py-4 text-left text-base font-semibold">
                {t.member.title}
              </caption>
              <thead>
                <tr className="border-b border-[var(--line)] text-left text-[var(--muted)]">
                  <th className="px-4 py-3 font-medium" scope="col">
                    {t.common.month}
                  </th>
                  <th className="px-4 py-3 text-right font-medium" scope="col">
                    {t.member.hafta}
                  </th>
                  <th className="px-4 py-3 text-right font-medium" scope="col">
                    {t.member.interest}
                  </th>
                  <th className="px-4 py-3 text-right font-medium" scope="col">
                    {t.member.fines}
                  </th>
                  <th className="px-4 py-3 font-medium" scope="col">
                    {t.common.status}
                  </th>
                </tr>
              </thead>
              <tbody>
                {passbook.months.map((row) => (
                  <tr className="border-b border-[var(--line)] last:border-0" key={row.key}>
                    <td className="px-4 py-3">{row.label}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatPaise(row.haftaPaidPaise, whole)}
                      <span className="text-[var(--muted)]">
                        {" / "}
                        {formatPaise(row.haftaDuePaise, whole)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.interestDuePaise > 0
                        ? `${formatPaise(row.interestPaidPaise, whole)} / ${formatPaise(row.interestDuePaise, whole)}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.finePaise > 0 ? formatPaise(row.fineOutstandingPaise, whole) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                          row.settled
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-[var(--warn)]"
                        )}
                      >
                        {row.settled ? t.common.paid : t.common.outstanding}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {passbook.receipts.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-white">
            <table className="w-full min-w-[600px] text-sm">
              <caption className="border-b border-[var(--line)] px-5 py-4 text-left text-base font-semibold">
                {t.receipts.title}
              </caption>
              <thead>
                <tr className="border-b border-[var(--line)] text-left text-[var(--muted)]">
                  <th className="px-4 py-3 font-medium" scope="col">
                    {t.receipts.receiptNo}
                  </th>
                  <th className="px-4 py-3 font-medium" scope="col">
                    {t.common.date}
                  </th>
                  <th className="px-4 py-3 font-medium" scope="col">
                    {t.ledger.type}
                  </th>
                  <th className="px-4 py-3 text-right font-medium" scope="col">
                    {t.common.amount}
                  </th>
                  <th className="px-4 py-3 text-right font-medium" scope="col">
                    <span className="sr-only">{t.receipts.shareWhatsapp}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {passbook.receipts.map((receipt) => (
                  <tr className="border-b border-[var(--line)] last:border-0" key={receipt.id}>
                    <td className="px-4 py-3 font-medium tabular-nums">{receipt.receiptNo}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{receipt.issuedOn}</td>
                    <td className="px-4 py-3">{receipt.receiptType}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatPaise(receipt.amountPaise, whole)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ReceiptActions
                        copiedLabel={t.receipts.copied}
                        copyLabel={t.receipts.copy}
                        pdfLabel={t.ledger.downloadPdf}
                        receiptId={receipt.id}
                        recipientName={memberDisplayName}
                        recipientPhone={summary.phone}
                        shareLabel={t.receipts.shareWhatsapp}
                        shareUrl={whatsappShareUrl(
                          receipt.whatsappText ?? "",
                          summary.phone
                        )}
                        text={receipt.whatsappText ?? ""}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </DashboardPage>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--line)] pb-2">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
