import { Banknote, CalendarDays, CircleDollarSign, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { requireGroupAdmin } from "@/lib/auth";
import { getMessages } from "@/lib/i18n";
import { formatPaise } from "@/lib/money";
import { getGroupOverview } from "@/lib/repositories";

export default async function GroupPage() {
  const scope = await requireGroupAdmin();
  const [t, overview] = await Promise.all([getMessages(), getGroupOverview(scope.groupId)]);

  if (!overview) notFound();

  const dueDay = overview.cycle?.contributionDueDay ?? 10;
  const cycle = overview.cycle;
  const whole = { whole: true } as const;

  return (
    <DashboardPage
      eyebrow={cycle ? cycle.name : t.group.title}
      stats={[
        {
          label: t.group.members,
          value: String(overview.memberCount),
          icon: Users,
          hint: `${overview.totalShares} ${t.common.shares}`,
        },
        {
          label: t.group.expectedThisMonth,
          value: formatPaise(overview.monthlyExpectedPaise, whole),
          icon: Banknote,
          hint: `${formatPaise(overview.collectedThisMonthPaise, whole)} ${t.common.collected}`,
        },
        {
          label: t.group.outOnLoan,
          value: formatPaise(overview.outstandingPrincipalPaise, whole),
          icon: CircleDollarSign,
          hint: `${overview.activeLoanCount} ${t.common.active}`,
        },
        {
          label: t.group.haftaWindow,
          value: `1-${dueDay}`,
          icon: CalendarDays,
          hint: `${t.group.fineFromThe} ${dueDay + 1}`,
        },
      ]}
      subtitle={t.group.subtitle}
      title={overview.groupName}
    >
      <div className="rounded-lg border border-[var(--line)] bg-white p-5">
        <h2 className="text-base font-semibold">{t.group.cycleRules}</h2>
        {cycle ? (
          <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Rule
              label={t.group.interestRate}
              value={`${cycle.monthlyInterestRate}% ${t.group.perMonthRate}`}
            />
            <Rule
              label={t.group.repaymentWindow}
              value={`${cycle.maxRepaymentMonths} ${t.common.months}`}
            />
            <Rule
              label={t.group.borrowingLimit}
              value={`${cycle.maxLoanCorpusMultiple}x ${t.group.ofCorpusContributed}`}
            />
            <Rule
              label={t.group.distribution}
              value={
                cycle.distributionBase === "CORPUS_PLUS_INTEREST"
                  ? t.common.corpusPlusInterest
                  : t.common.interestOnly
              }
            />
            <Rule
              label={t.group.fines}
              value={cycle.distributeFines ? t.common.sharedWithMembers : t.common.keptInCorpus}
            />
            <Rule
              label={t.group.availableToLend}
              value={formatPaise(overview.availableFundsPaise, whole)}
            />
          </dl>
        ) : (
          <p className="mt-3 text-sm text-[var(--muted)]">{t.group.noCycle}</p>
        )}
      </div>
    </DashboardPage>
  );
}

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--line)] pb-2">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
