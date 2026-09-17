import { CalendarPlus, Lock, LockOpen } from "lucide-react";
import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { ExportButton } from "@/components/ui/export-button";
import { requireGroupAdmin } from "@/lib/auth";
import {
  formatYearMonth,
  monthsBetween,
  yearMonthKey,
  yearMonthOf,
  type YearMonth,
} from "@/lib/finance";
import { getMessages } from "@/lib/i18n";
import { atLeastZero, decimalToPaise, formatPaise } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { generateScheduleAction, lockPeriodAction } from "../actions";
import { ContributionRow } from "./contribution-row";

type PageProps = { searchParams: Promise<{ month?: string }> };

export default async function ContributionsPage({ searchParams }: PageProps) {
  const scope = await requireGroupAdmin();
  const [t, { month: monthParam }] = await Promise.all([getMessages(), searchParams]);

  const cycle = await prisma.cycle.findFirst({
    where: { groupId: scope.groupId, status: { in: ["ACTIVE", "DRAFT", "CLOSING"] } },
    orderBy: { startsOn: "desc" },
    select: { id: true, name: true, startsOn: true, endsOn: true, contributionDueDay: true },
  });

  if (!cycle) {
    return (
      <Empty subtitle={t.group.noCycle} title={t.contributions.title} />
    );
  }

  const today = new Date();
  const horizon = today < cycle.endsOn ? today : cycle.endsOn;
  const months = monthsBetween(cycle.startsOn, horizon);
  const fallback = months.at(-1) ?? yearMonthOf(today);
  const selected = parseMonth(monthParam) ?? fallback;

  const [rows, lock] = await Promise.all([
    prisma.contribution.findMany({
      where: { cycleId: cycle.id, year: selected.year, month: selected.month },
      orderBy: { member: { displayName: "asc" } },
      select: {
        id: true,
        amountDue: true,
        amountPaid: true,
        paidOn: true,
        member: { select: { id: true, displayName: true } },
        fines: {
          select: { id: true, amount: true, amountPaid: true, waivedAmount: true, daysLate: true },
        },
      },
    }),
    prisma.periodLock.findUnique({
      where: {
        cycleId_month_year: { cycleId: cycle.id, month: selected.month, year: selected.year },
      },
      select: { id: true },
    }),
  ]);

  const whole = { whole: true } as const;
  const isLocked = Boolean(lock);

  const totals = rows.reduce(
    (acc, row) => {
      const due = decimalToPaise(row.amountDue);
      const paid = decimalToPaise(row.amountPaid);
      return {
        due: acc.due + due,
        paid: acc.paid + paid,
        outstanding: acc.outstanding + atLeastZero(due - paid),
      };
    },
    { due: 0, paid: 0, outstanding: 0 }
  );

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t.contributions.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            {t.contributions.subtitle}
          </p>
        </div>

        <ExportButton hint={t.ledger.exportHint} label={t.ledger.export} report="contributions" />

        <div className="rounded-lg border border-[var(--line)] bg-white p-4">
          <ActionForm
            action={generateScheduleAction}
            compact
            pendingLabel={t.contributions.generating}
            submitLabel={t.contributions.generate}
            variant="secondary"
          >
            <p className="flex items-start gap-2 text-xs text-[var(--muted)]">
              <CalendarPlus className="mt-0.5 shrink-0" size={14} />
              {t.contributions.generateHint}
            </p>
          </ActionForm>
        </div>
      </div>

      {months.length > 0 ? (
        <nav aria-label={t.common.month} className="mt-6 flex flex-wrap gap-2">
          {months.map((period) => {
            const active = yearMonthKey(period) === yearMonthKey(selected);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-ring rounded-md border px-3 py-1.5 text-sm font-medium transition",
                  active
                    ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                    : "border-[var(--line)] bg-white text-[var(--muted)] hover:border-[var(--primary)]"
                )}
                href={`/group/contributions?month=${yearMonthKey(period)}`}
                key={yearMonthKey(period)}
              >
                {formatYearMonth(period)}
              </Link>
            );
          })}
        </nav>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Summary label={t.common.due} value={formatPaise(totals.due, whole)} />
        <Summary label={t.common.paid} value={formatPaise(totals.paid, whole)} />
        <Summary label={t.common.outstanding} value={formatPaise(totals.outstanding, whole)} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--line)] bg-white p-4">
        {isLocked ? (
          <>
            <span className="flex items-center gap-2 text-sm font-medium text-[var(--warn)]">
              <Lock size={15} />
              {t.contributions.lockedNote}
            </span>
            <ActionForm
              action={lockPeriodAction}
              compact
              hidden={{
                year: String(selected.year),
                month: String(selected.month),
                unlock: "1",
              }}
              submitLabel={t.contributions.unlockMonth}
              variant="secondary"
            />
          </>
        ) : (
          <>
            <span className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <LockOpen size={15} />
              {formatYearMonth(selected)}
            </span>
            <ActionForm
              action={lockPeriodAction}
              compact
              hidden={{ year: String(selected.year), month: String(selected.month) }}
              submitLabel={t.contributions.lockMonth}
              variant="secondary"
            />
          </>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-center text-sm text-[var(--muted)]">
          {t.contributions.noRows}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--line)] bg-white">
          <table className="w-full min-w-[820px] text-sm">
            <caption className="sr-only">
              {t.contributions.title} {formatYearMonth(selected)}
            </caption>
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-[var(--muted)]">
                <th className="px-4 py-3 font-medium" scope="col">
                  {t.common.member}
                </th>
                <th className="px-4 py-3 text-right font-medium" scope="col">
                  {t.common.due}
                </th>
                <th className="px-4 py-3 text-right font-medium" scope="col">
                  {t.common.paid}
                </th>
                <th className="px-4 py-3 text-right font-medium" scope="col">
                  {t.group.fines}
                </th>
                <th className="px-4 py-3 font-medium" scope="col">
                  {t.common.status}
                </th>
                <th className="px-4 py-3 text-right font-medium" scope="col">
                  <span className="sr-only">{t.contributions.recordPayment}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const due = decimalToPaise(row.amountDue);
                const paid = decimalToPaise(row.amountPaid);
                const outstanding = atLeastZero(due - paid);
                const fine = row.fines[0] ?? null;
                const fineOutstanding = fine
                  ? atLeastZero(
                      decimalToPaise(fine.amount) -
                        decimalToPaise(fine.amountPaid) -
                        decimalToPaise(fine.waivedAmount)
                    )
                  : 0;

                return (
                  <ContributionRow
                    key={row.id}
                    labels={{
                      record: t.contributions.recordPayment,
                      amount: t.common.amount,
                      finePaid: t.contributions.finePaid,
                      paidOn: t.contributions.paidOn,
                      notes: t.common.notes,
                      daysLate: t.contributions.daysLate,
                      fullyPaid: t.contributions.fullyPaid,
                      partiallyPaid: t.contributions.partiallyPaid,
                      unpaid: t.contributions.unpaid,
                      locked: t.contributions.locked,
                    }}
                    row={{
                      id: row.id,
                      memberName: row.member.displayName,
                      dueLabel: formatPaise(due, whole),
                      paidLabel: formatPaise(paid, whole),
                      outstandingRupees: (outstanding / 100).toFixed(2),
                      fineLabel: fineOutstanding > 0 ? formatPaise(fineOutstanding, whole) : "-",
                      fineRupees: (fineOutstanding / 100).toFixed(2),
                      daysLate: fine?.daysLate ?? 0,
                      state: paid >= due ? "paid" : paid > 0 ? "partial" : "unpaid",
                      locked: isLocked,
                    }}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function parseMonth(value?: string): YearMonth | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-white p-4">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function Empty({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
      <p className="mt-3 rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-sm text-[var(--muted)]">
        {subtitle}
      </p>
    </section>
  );
}
