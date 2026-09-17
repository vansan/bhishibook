import { Banknote, CircleDollarSign, ReceiptText, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { requireMemberScope } from "@/lib/auth";
import { getMessages } from "@/lib/i18n";
import { formatPaise } from "@/lib/money";
import { getGroupOverview, getMemberSummary } from "@/lib/repositories";

export default async function MemberPage() {
  const scope = await requireMemberScope();

  const [t, summary, overview] = await Promise.all([
    getMessages(),
    getMemberSummary(scope.groupId, scope.memberId),
    getGroupOverview(scope.groupId),
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

  return (
    <AppShell groupName={overview?.groupName}>
      <DashboardPage
        eyebrow={summary.displayName}
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
